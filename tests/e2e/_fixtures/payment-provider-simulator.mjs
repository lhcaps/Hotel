#!/usr/bin/env node
// tests/e2e/_fixtures/payment-provider-simulator.mjs
//
// Deterministic loopback payment provider simulator for Gate B11/B12
// browser E2E and the Phase 6F demo. Implements the surface area the
// production adapters exercise:
//
//   MoMo
//     POST /v2/gateway/api/create    -> signed JSON create response
//     POST /v2/gateway/api/query     -> signed JSON query response
//     GET  /momo-test/pay?orderId=.. -> browser "checkout" page that
//                                        submits an IPN back to the API
//     POST /__control/momo           -> test orchestration (mode, etc.)
//
//   VNPAY
//     GET  /vnpay-test/pay?...       -> browser "checkout" page that
//                                        submits a GET IPN to the API
//     GET  /__control/vnpay          -> test orchestration
//
// The simulator signs responses using the same HMAC-SHA256 (MoMo) and
// HMAC-SHA512 (VNPAY) algorithms as production. Test code reaches the
// simulator at the URLs configured by the global-setup / demo runner.
// The simulator is bound to loopback only and refuses non-loopback
// request hosts; the NODE_ENV guard ensures it never starts in
// production code paths.
//
// Modes (set via POST /__control/<provider>):
//   {mode:'verify'}            -> verified IPN outcome (success)
//   {mode:'cancel'}            -> cancelled IPN outcome
//   {mode:'tamper'}            -> returns an IPN with a bad signature
//   {mode:'fail-create'}       -> createCheckout returns error code
//   {mode:'redirect-delay-ms', value:N} -> payment page waits N ms
//                                          before submitting the IPN
//   {mode:'duplicate'}         -> pay page submits the IPN twice
//
// Default mode is 'verify'. Modes are per-provider stateful: the
// simulator keeps the most recent mode until overwritten.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number.parseInt(process.env.PAYMENT_SIMULATOR_PORT ?? '3090', 10);
const HOST = process.env.PAYMENT_SIMULATOR_HOST ?? '127.0.0.1';
const MOMO_PARTNER_CODE = process.env.PAYMENT_SIMULATOR_MOMO_PARTNER_CODE ?? 'PLAYWRIGHT_MOMO';
const MOMO_ACCESS_KEY =
  process.env.PAYMENT_SIMULATOR_MOMO_ACCESS_KEY ?? 'playwright-momo-access-key';
const MOMO_SECRET_KEY =
  process.env.PAYMENT_SIMULATOR_MOMO_SECRET_KEY ??
  'playwright-momo-secret-key-at-least-thirty-two-characters';
const VNPAY_TMN_CODE = process.env.PAYMENT_SIMULATOR_VNPAY_TMN_CODE ?? 'PLAYWRIGHTVNPAY';
const VNPAY_HASH_SECRET =
  process.env.PAYMENT_SIMULATOR_VNPAY_HASH_SECRET ??
  'playwright-vnpay-secret-at-least-thirty-two-characters';
const MOMO_IPN_URL =
  process.env.PAYMENT_SIMULATOR_MOMO_IPN_URL ?? 'http://127.0.0.1:3101/api/v1/webhooks/momo';
const VNPAY_IPN_URL =
  process.env.PAYMENT_SIMULATOR_VNPAY_IPN_URL ?? 'http://127.0.0.1:3101/api/v1/webhooks/vnpay';
// Optional loopback-only base for the default browser back-redirect. When set
// and a per-provider `backRedirectUrl` is NOT explicitly configured, the
// simulator derives `${base}/{orderId}` so the browser returns the customer to
// the persistent booking page without requiring Playwright to drive the
// control plane first. The same loopback guard used for `backRedirectUrl`
// applies; non-loopback bases are rejected.
const DEFAULT_BACK_REDIRECT_BASE = process.env.PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE ?? '';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DISABLED_IN_PRODUCTION = NODE_ENV === 'production';

if (DISABLED_IN_PRODUCTION) {
  process.stderr.write(
    '[payment-simulator] Refusing to start: NODE_ENV=production disables simulators.\n',
  );
  process.exit(0);
}

// Phase 2 adds an opt-in browser-side redirect from the simulator's pay page
// back to the booking page. The URL must be loopback-only; non-loopback hosts
// are refused to keep the simulator a safe loopback fixture. Tests opt in via
// `POST /__control/<provider>` with `{ backRedirectUrl: '<loopback-url>' }`.
// Omitting the field disables the redirect so the original redirect-only
// behaviour remains the default.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLoopbackHost(hostname) {
  const lower = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(lower)) return true;
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return LOOPBACK_HOSTS.has(lower.slice(1, -1));
  }
  return false;
}

function validateBackRedirectUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('backRedirectUrl.malformedUrl');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('backRedirectUrl.unsupportedScheme');
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error('backRedirectUrl.hostNotLoopback');
  }
  return parsed.toString();
}

function validateBackRedirectBase(rawBase) {
  if (typeof rawBase !== 'string' || rawBase.length === 0) return '';
  let parsed;
  try {
    parsed = new URL(rawBase);
  } catch {
    throw new Error('defaultBackRedirectBase.malformedUrl');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('defaultBackRedirectBase.unsupportedScheme');
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error('defaultBackRedirectBase.hostNotLoopback');
  }
  // Strip trailing slashes so we can safely append '/<orderId>'.
  let normalized = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.protocol}//${parsed.host}${normalized}`;
}

// Sanity-check the optional env var at startup so a misconfiguration fails
// fast instead of silently disabling the default redirect.
const RESOLVED_DEFAULT_BACK_REDIRECT_BASE = (() => {
  if (DEFAULT_BACK_REDIRECT_BASE === '') return '';
  try {
    return validateBackRedirectBase(DEFAULT_BACK_REDIRECT_BASE);
  } catch (error) {
    process.stderr.write(
      `[payment-simulator] Refusing to start: PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE is invalid (${error instanceof Error ? error.message : String(error)})\n`,
    );
    process.exit(2);
  }
})();

const providerState = {
  momo: {
    mode: 'verify',
    redirectDelayMs: 0,
    duplicateIpns: false,
    backRedirectUrl: '',
  },
  vnpay: {
    mode: 'verify',
    redirectDelayMs: 0,
    duplicateIpns: false,
    backRedirectUrl: '',
  },
};

const requestCounts = {
  momoCreate: 0,
  momoQuery: 0,
  momoIpnAttempts: 0,
  vnpayIpnAttempts: 0,
};

function resolveBackRedirectUrl(provider, orderId) {
  const state = providerState[provider];
  if (state.backRedirectUrl !== '') return state.backRedirectUrl;
  if (RESOLVED_DEFAULT_BACK_REDIRECT_BASE === '') return '';
  // The order id is the booking code (server-side mapping is authoritative).
  // Append the booking code as a single segment. Re-validate to keep the
  // safety contract: any non-loopback base is rejected.
  try {
    return validateBackRedirectUrl(
      `${RESOLVED_DEFAULT_BACK_REDIRECT_BASE}/${encodeURIComponent(orderId)}`,
    );
  } catch {
    return '';
  }
}

function log(message, fields) {
  const timestamp = new Date().toISOString();
  const suffix = fields === undefined ? '' : ` ${JSON.stringify(fields)}`;
  process.stdout.write(`[payment-simulator ${timestamp}] ${message}${suffix}\n`);
}

function momoCanonical(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function momoResponseCanonical(fields) {
  return momoCanonical(fields);
}

function momoIpnCanonical(fields) {
  return momoCanonical(fields);
}

function signMomo(secretKey, canonical) {
  return createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');
}

function momoNow() {
  return Date.now();
}

// Provider transaction ids must be unique across payment attempts. Reusing a
// friendly fixture value (for example `424242`) makes the real booking-core
// transaction-conflict safeguard correctly put every later payment into
// REVIEW_REQUIRED, which hides the happy-path behaviour this simulator is
// meant to exercise. Keep the id deterministic per order so duplicate IPNs
// still model a single provider transaction.
function transactionIdFor(provider, orderId) {
  return createHash('sha256')
    .update(`${provider}|${orderId}`, 'utf8')
    .digest()
    .readBigUInt64BE(0)
    .toString();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function jsonResponse(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function htmlResponse(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(body);
}

function hostMatchesLoopback(request) {
  const host = (request.headers.host ?? '').split(':')[0];
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function handleMomoCreate(request, response, body) {
  requestCounts.momoCreate += 1;
  if (providerState.momo.mode === 'fail-create') {
    jsonResponse(response, 200, {
      partnerCode: MOMO_PARTNER_CODE,
      orderId: body.orderId,
      requestId: body.requestId,
      amount: body.amount,
      responseTime: momoNow(),
      message: 'simulator forced create failure',
      resultCode: 1001,
      signature: '0'.repeat(64),
    });
    return;
  }
  const responseFields = {
    partnerCode: MOMO_PARTNER_CODE,
    orderId: body.orderId,
    requestId: body.requestId,
    amount: body.amount,
    message: 'Success',
    payUrl: `http://${HOST}:${PORT}/momo-test/pay?orderId=${encodeURIComponent(body.orderId)}&amount=${body.amount}`,
    responseTime: momoNow(),
    resultCode: 0,
  };
  const canonical = momoResponseCanonical({
    accessKey: MOMO_ACCESS_KEY,
    amount: responseFields.amount,
    message: responseFields.message,
    orderId: responseFields.orderId,
    partnerCode: responseFields.partnerCode,
    payUrl: responseFields.payUrl,
    requestId: responseFields.requestId,
    responseTime: responseFields.responseTime,
    resultCode: responseFields.resultCode,
  });
  jsonResponse(response, 200, {
    ...responseFields,
    signature: signMomo(MOMO_SECRET_KEY, canonical),
  });
}

async function handleMomoQuery(request, response, body) {
  requestCounts.momoQuery += 1;
  const outcome = providerState.momo.mode === 'cancel' ? 1006 : 0;
  const responseFields = {
    partnerCode: MOMO_PARTNER_CODE,
    orderId: body.orderId,
    requestId: body.requestId,
    amount: body.amount ?? 0,
    responseTime: momoNow(),
    message: outcome === 0 ? 'Success' : 'User cancelled',
    resultCode: outcome,
    transId: outcome === 0 ? transactionIdFor('momo', body.orderId) : undefined,
  };
  const canonical = momoCanonical({
    accessKey: MOMO_ACCESS_KEY,
    orderId: responseFields.orderId,
    partnerCode: responseFields.partnerCode,
    requestId: responseFields.requestId,
  });
  const result = {
    ...responseFields,
    signature: signMomo(MOMO_SECRET_KEY, canonical),
  };
  if (result.transId === undefined) delete result.transId;
  jsonResponse(response, 200, result);
}

function buildMomoIpn({ orderId, amount, resultCode, transId, tamperSignature }) {
  const responseTime = momoNow();
  const fields = {
    accessKey: MOMO_ACCESS_KEY,
    amount,
    extraData: '',
    message: resultCode === 0 ? 'Success' : 'Failure',
    orderId,
    orderInfo: `Room booking ${orderId}`,
    orderType: 'momo_wallet',
    partnerCode: MOMO_PARTNER_CODE,
    payType: 'webApp',
    requestId: orderId,
    responseTime,
    resultCode,
    transId,
  };
  const canonical = momoIpnCanonical(fields);
  const signature =
    tamperSignature === true ? 'f'.repeat(64) : signMomo(MOMO_SECRET_KEY, canonical);
  return {
    orderType: fields.orderType,
    amount: fields.amount,
    partnerCode: fields.partnerCode,
    orderId: fields.orderId,
    extraData: fields.extraData,
    signature,
    transId: fields.transId,
    responseTime: fields.responseTime,
    resultCode: fields.resultCode,
    message: fields.message,
    payType: fields.payType,
    requestId: fields.requestId,
    orderInfo: fields.orderInfo,
  };
}

async function postMomoIpn(ipn) {
  requestCounts.momoIpnAttempts += 1;
  const response = await fetch(MOMO_IPN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ipn),
  });
  log('momo.ipn.post', { status: response.status });
  return response;
}

async function renderMomoPayPage(response, url) {
  const orderId = url.searchParams.get('orderId') ?? '';
  const amount = Number.parseInt(url.searchParams.get('amount') ?? '0', 10);
  const { mode, redirectDelayMs, duplicateIpns } = providerState.momo;
  const resultCode = mode === 'cancel' ? 1006 : mode === 'tamper' ? 0 : 0;
  const tamper = mode === 'tamper';
  const ipn = buildMomoIpn({
    orderId,
    amount,
    resultCode,
    transId: transactionIdFor('momo', orderId),
    tamperSignature: tamper,
  });
  const duplicates = duplicateIpns ? 2 : 1;
  setTimeout(() => {
    void (async () => {
      for (let index = 0; index < duplicates; index += 1) {
        await postMomoIpn(ipn);
      }
    })();
  }, redirectDelayMs);
  const body = renderSimulatorCheckoutPage({
    title: 'MoMo simulator',
    orderId,
    amount,
    mode,
    backRedirectUrl: resolveBackRedirectUrl('momo', orderId),
  });
  htmlResponse(response, 200, body);
}

function buildVnpayIpnUrl({ orderId, amount, resultCode, transactionNo, tamperSignature }) {
  const payDate = formatVnpayDate(new Date());
  const fields = {
    vnp_Amount: String(amount * 100),
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `Room booking ${orderId}`,
    vnp_PayDate: payDate,
    vnp_ResponseCode: resultCode,
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_TransactionNo: transactionNo,
    vnp_TransactionStatus: resultCode,
    vnp_TxnRef: orderId,
  };
  // Keep this byte-for-byte aligned with production's URLSearchParams
  // canonicalisation. In particular, spaces are encoded as `+`, not `%20`.
  const canonicalParams = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)
    .filter(([key, value]) => key.startsWith('vnp_') && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))) {
    canonicalParams.append(key, value);
  }
  const canonical = canonicalParams.toString();
  const signature = tamperSignature
    ? 'f'.repeat(128)
    : createHmac('sha512', VNPAY_HASH_SECRET).update(canonical, 'utf8').digest('hex');
  const params = new URLSearchParams({ ...fields, vnp_SecureHash: signature });
  return `${VNPAY_IPN_URL}?${params.toString()}`;
}

function formatVnpayDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}${lookup.month}${lookup.day}${lookup.hour}${lookup.minute}${lookup.second}`;
}

async function getVnpayIpn(url) {
  requestCounts.vnpayIpnAttempts += 1;
  const response = await fetch(url.toString(), { method: 'GET', redirect: 'manual' });
  log('vnpay.ipn.get', { status: response.status });
  return response;
}

async function renderVnpayPayPage(response, url) {
  const orderId = url.searchParams.get('vnp_TxnRef') ?? '';
  const amount = Number.parseInt(url.searchParams.get('vnp_Amount') ?? '0', 10) / 100;
  const { mode, redirectDelayMs, duplicateIpns } = providerState.vnpay;
  const success = mode === 'verify';
  const tamper = mode === 'tamper';
  const ipnUrl = buildVnpayIpnUrl({
    orderId,
    amount,
    resultCode: success ? '00' : '24',
    transactionNo: transactionIdFor('vnpay', orderId),
    tamperSignature: tamper,
  });
  const duplicates = duplicateIpns ? 2 : 1;
  setTimeout(() => {
    void (async () => {
      for (let index = 0; index < duplicates; index += 1) {
        await getVnpayIpn(ipnUrl);
      }
    })();
  }, redirectDelayMs);
  const body = renderSimulatorCheckoutPage({
    title: 'VNPAY simulator',
    orderId,
    amount,
    mode,
    backRedirectUrl: resolveBackRedirectUrl('vnpay', orderId),
  });
  htmlResponse(response, 200, body);
}

function renderSimulatorCheckoutPage({ title, orderId, amount, mode, backRedirectUrl }) {
  const redirectScript =
    backRedirectUrl === ''
      ? ''
      : `<script>
        // Phase 2 browser vertical: the simulator is configured with a
        // loopback back-redirect URL. Wait briefly for the IPN to settle on
        // the API side, then send the browser back to the booking detail.
        // The redirect is opt-in per provider state and refuses non-loopback
        // hosts at control time.
        window.setTimeout(function () {
          window.location.replace(${JSON.stringify(backRedirectUrl)});
        }, 750);
      </script>`;
  return `<!doctype html>
<html><head><title>${escapeHtml(title)}</title></head><body>
<h1>${escapeHtml(title)}</h1>
<p>Order: <code>${escapeHtml(orderId)}</code></p>
<p>Amount: <code>${amount}</code></p>
<p>Mode: <code>${escapeHtml(mode)}</code></p>
${redirectScript}
</body></html>`;
}

async function handleControl(request, response, provider, url) {
  const body = await readJsonBody(request);
  const state = providerState[provider];
  if (
    body.mode === 'verify' ||
    body.mode === 'cancel' ||
    body.mode === 'tamper' ||
    body.mode === 'fail-create'
  ) {
    state.mode = body.mode;
  }
  if (
    typeof body.redirectDelayMs === 'number' &&
    Number.isFinite(body.redirectDelayMs) &&
    body.redirectDelayMs >= 0
  ) {
    state.redirectDelayMs = Math.min(60_000, Math.floor(body.redirectDelayMs));
  }
  if (typeof body.duplicateIpns === 'boolean') {
    state.duplicateIpns = body.duplicateIpns;
  }
  if (typeof body.backRedirectUrl === 'string') {
    if (body.backRedirectUrl.trim() === '') {
      state.backRedirectUrl = '';
    } else {
      try {
        state.backRedirectUrl = validateBackRedirectUrl(body.backRedirectUrl);
      } catch (error) {
        jsonResponse(response, 400, {
          ok: false,
          provider,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  }
  if (body.reset === true) {
    state.mode = 'verify';
    state.redirectDelayMs = 0;
    state.duplicateIpns = false;
    state.backRedirectUrl = '';
  }
  jsonResponse(response, 200, { ok: true, provider, state, counts: requestCounts });
  log(`control.${provider}`, { state });
}

function handleHealth(response) {
  jsonResponse(response, 200, {
    ok: true,
    counts: requestCounts,
    providers: providerState,
    defaultBackRedirectBase: RESOLVED_DEFAULT_BACK_REDIRECT_BASE,
  });
}

async function router(request, response) {
  if (!hostMatchesLoopback(request)) {
    response.statusCode = 400;
    response.end('Bad host');
    return;
  }
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;
  try {
    if (pathname === '/__health' && request.method === 'GET') {
      handleHealth(response);
      return;
    }
    if (pathname === '/__control/momo' && request.method === 'POST') {
      await handleControl(request, response, 'momo', url);
      return;
    }
    if (pathname === '/__control/vnpay' && request.method === 'POST') {
      await handleControl(request, response, 'vnpay', url);
      return;
    }
    if (pathname === '/v2/gateway/api/create' && request.method === 'POST') {
      const body = await readJsonBody(request);
      await handleMomoCreate(request, response, body);
      return;
    }
    if (pathname === '/v2/gateway/api/query' && request.method === 'POST') {
      const body = await readJsonBody(request);
      await handleMomoQuery(request, response, body);
      return;
    }
    if (pathname === '/momo-test/pay' && request.method === 'GET') {
      await renderMomoPayPage(response, url);
      return;
    }
    if (pathname === '/vnpay-test/pay' && request.method === 'GET') {
      await renderVnpayPayPage(response, url);
      return;
    }
    response.statusCode = 404;
    response.end('not found');
  } catch (error) {
    log('error', { message: error instanceof Error ? error.message : String(error) });
    response.statusCode = 500;
    response.end('simulator error');
  }
}

const server = createServer((request, response) => {
  void router(request, response);
});

server.listen(PORT, HOST, () => {
  log('started', { host: HOST, port: PORT, momoIpnUrl: MOMO_IPN_URL, vnpayIpnUrl: VNPAY_IPN_URL });
});

async function shutdown(reason) {
  log('shutdown', { reason });
  await new Promise((resolve) => server.close(() => resolve()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
