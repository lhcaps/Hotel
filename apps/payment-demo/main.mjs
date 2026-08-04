/* global fetch, process */

import { Buffer } from 'node:buffer';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath, URL, URLSearchParams } from 'node:url';
import QRCode from 'qrcode';

const MAX_BODY_BYTES = 64 * 1024;
const BOOKING_CODE_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const BOOKING_ORDER_INFO_PATTERN = /^Room booking ([A-Za-z0-9-]{1,64})$/;
const CHECKOUT_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function requireString(source, key, minimum = 1) {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length < minimum) {
    throw new Error(`${key} must be at least ${minimum} characters`);
  }
  return value.trim();
}

function requireUrl(source, key, { https = false } = {}) {
  const value = requireString(source, key);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
  if (https && parsed.protocol !== 'https:') throw new Error(`${key} must be HTTPS`);
  if (!https && !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${key} must use HTTP or HTTPS`);
  }
  return parsed;
}

function normalizeOrigin(url) {
  return url.origin;
}

function optionalPositiveInteger(source, key, fallback, minimum = 1) {
  const raw = source[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${key} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

export function loadEnvironment(source = process.env) {
  const publicOrigin = normalizeOrigin(
    requireUrl(source, 'PAYMENT_DEMO_PUBLIC_ORIGIN', { https: true }),
  );
  const webOrigin = normalizeOrigin(requireUrl(source, 'PAYMENT_DEMO_WEB_ORIGIN', { https: true }));
  if (publicOrigin === webOrigin) {
    throw new Error('PAYMENT_DEMO_WEB_ORIGIN must not equal PAYMENT_DEMO_PUBLIC_ORIGIN');
  }
  const port = Number.parseInt(source.PAYMENT_DEMO_PORT ?? '3090', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PAYMENT_DEMO_PORT must be a valid TCP port');
  }
  return Object.freeze({
    host: source.PAYMENT_DEMO_HOST ?? '0.0.0.0',
    port,
    publicOrigin,
    publicHost: new URL(publicOrigin).host,
    webOrigin,
    momoIpnUrl: requireUrl(source, 'PAYMENT_DEMO_MOMO_IPN_URL').toString(),
    vnpayIpnUrl: requireUrl(source, 'PAYMENT_DEMO_VNPAY_IPN_URL').toString(),
    controlToken: requireString(source, 'PAYMENT_DEMO_CONTROL_TOKEN', 32),
    momoPartnerCode: requireString(source, 'MOMO_PARTNER_CODE'),
    momoAccessKey: requireString(source, 'MOMO_ACCESS_KEY'),
    momoSecretKey: requireString(source, 'MOMO_SECRET_KEY', 32),
    vnpayTmnCode: requireString(source, 'VNPAY_TMN_CODE'),
    vnpayHashSecret: requireString(source, 'VNPAY_HASH_SECRET', 32),
    rateLimitMax: optionalPositiveInteger(source, 'PAYMENT_DEMO_RATE_LIMIT_MAX', 60),
    rateLimitWindowMs: optionalPositiveInteger(
      source,
      'PAYMENT_DEMO_RATE_LIMIT_WINDOW_MS',
      60_000,
      1_000,
    ),
  });
}

function hmac(algorithm, secret, text) {
  return createHmac(algorithm, secret).update(text, 'utf8').digest('hex');
}

function sameSecret(expected, candidate) {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const candidateBytes = Buffer.from(candidate ?? '', 'utf8');
  return (
    expectedBytes.length === candidateBytes.length && timingSafeEqual(expectedBytes, candidateBytes)
  );
}

function transactionId(provider, orderId) {
  return createHash('sha256')
    .update(`${provider}|${orderId}`, 'utf8')
    .digest()
    .readBigUInt64BE(0)
    .toString();
}

function bookingCodeFromOrderInfo(orderInfo) {
  if (typeof orderInfo !== 'string') return '';
  return BOOKING_ORDER_INFO_PATTERN.exec(orderInfo.trim())?.[1] ?? '';
}

function checkoutToken(environment, order, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      provider: order.provider,
      orderId: order.orderId,
      amount: order.amount,
      orderInfo: order.orderInfo,
      bookingCode: order.bookingCode,
      expiresAt: now + CHECKOUT_TOKEN_TTL_MS,
    }),
    'utf8',
  ).toString('base64url');
  const signature = hmac('sha256', environment.controlToken, payload);
  return `${payload}.${signature}`;
}

function orderFromCheckoutToken(
  environment,
  token,
  expectedProvider,
  expectedOrderId,
  now = Date.now(),
) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('checkout token is unavailable');
  }
  const separator = token.lastIndexOf('.');
  if (separator <= 0) throw new Error('checkout token is invalid');
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!sameSecret(hmac('sha256', environment.controlToken, payload), signature)) {
    throw new Error('checkout token is invalid');
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('checkout token is invalid');
  }
  if (
    parsed?.version !== 1 ||
    parsed.provider !== expectedProvider ||
    parsed.orderId !== expectedOrderId ||
    !Number.isSafeInteger(parsed.amount) ||
    parsed.amount < 1 ||
    typeof parsed.orderInfo !== 'string' ||
    typeof parsed.bookingCode !== 'string' ||
    !BOOKING_CODE_PATTERN.test(parsed.bookingCode) ||
    !Number.isSafeInteger(parsed.expiresAt) ||
    parsed.expiresAt <= now
  ) {
    throw new Error('checkout token is invalid');
  }
  return {
    orderId: parsed.orderId,
    amount: parsed.amount,
    orderInfo: parsed.orderInfo,
    bookingCode: parsed.bookingCode,
    provider: parsed.provider,
    settled: false,
    settling: null,
  };
}

function resolveCheckoutOrder(orders, environment, requestUrl, provider) {
  const orderId = requestUrl.searchParams.get('orderId') ?? '';
  const existing = orders.get(orderId);
  const token = requestUrl.searchParams.get('token');
  if (token === null) {
    if (existing === undefined || existing.provider !== provider) throw new Error('unknown order');
    return existing;
  }
  const tokenOrder = orderFromCheckoutToken(environment, token, provider, orderId);
  if (existing !== undefined) {
    if (
      existing.provider !== tokenOrder.provider ||
      existing.amount !== tokenOrder.amount ||
      existing.orderInfo !== tokenOrder.orderInfo
    ) {
      throw new Error('checkout token is invalid');
    }
    if (existing.bookingCode === '') existing.bookingCode = tokenOrder.bookingCode;
    return existing;
  }
  orders.set(orderId, tokenOrder);
  return tokenOrder;
}

function requireCheckoutBooking(orders, environment, requestUrl, provider) {
  const order = resolveCheckoutOrder(orders, environment, requestUrl, provider);
  if (order.bookingCode === '') throw new Error('booking mapping is unavailable');
  return order;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function html(response, status, body, formActionOrigin = "'self'") {
  response.statusCode = status;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader(
    'content-security-policy',
    `default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action ${formActionOrigin}`,
  );
  response.end(body);
}

function redirect(response, target) {
  response.statusCode = 303;
  response.setHeader('location', target);
  response.setHeader('cache-control', 'no-store');
  response.end();
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(request) {
  const text = await readBody(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid JSON');
  }
}

async function readForm(request) {
  return new URLSearchParams(await readBody(request));
}

function momoCanonical(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function momoResponseCanonical(fields) {
  return [
    `accessKey=${fields.accessKey}`,
    `amount=${fields.amount}`,
    `message=${fields.message}`,
    `orderId=${fields.orderId}`,
    `partnerCode=${fields.partnerCode}`,
    `payUrl=${fields.payUrl}`,
    `requestId=${fields.requestId}`,
    `responseTime=${fields.responseTime}`,
    `resultCode=${fields.resultCode}`,
  ].join('&');
}

function vnpayCanonical(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)
    .filter(([key, value]) => key.startsWith('vnp_') && key !== 'vnp_SecureHash' && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))) {
    params.append(key, value);
  }
  return params.toString();
}

function vnpayDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function trustedPublicRequest(request, environment) {
  const host = String(request.headers.host ?? '').toLowerCase();
  return host === environment.publicHost.toLowerCase();
}

function requestClientKey(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',', 1)[0].trim();
  }
  return request.socket.remoteAddress ?? 'unknown';
}

function createRateLimiter({ max, windowMs }) {
  const windows = new Map();
  return {
    consume(key, now = Date.now()) {
      const current = windows.get(key);
      const entry =
        current === undefined || now >= current.resetAt
          ? { count: 0, resetAt: now + windowMs }
          : current;
      entry.count += 1;
      windows.set(key, entry);
      return {
        allowed: entry.count <= max,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
      };
    },
  };
}

async function checkoutPage({ provider, orderId, amount, confirmPath, confirmToken, checkoutUrl }) {
  const paymentQr = await QRCode.toDataURL(checkoutUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(provider)} demo payment</title>
<style>body{font:16px system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem}aside{padding:1rem;background:#fff3cd;border:1px solid #ffec99}button{padding:.75rem 1rem;font-weight:700}.payment-qr{max-width:15rem;margin:1.5rem 0;padding:1rem;border:1px solid #ddd;border-radius:.5rem}.payment-qr img{display:block;width:15rem;height:15rem;max-width:100%}</style></head>
<body><h1>${escapeHtml(provider)} demo payment</h1><aside><strong>DEMO — NO REAL MONEY.</strong> This screen only verifies the Room Management demo flow. Do not enter bank, card, or wallet credentials.</aside>
<p>Order <code>${escapeHtml(orderId)}</code></p><p>Amount <strong>${escapeHtml(amount)} VND</strong></p>
<section class="payment-qr" aria-label="Payment QR"><h2>Payment QR</h2><img alt="Payment QR code" src="${escapeHtml(paymentQr)}"><p>Scan to open this demo checkout on another device.</p></section>
<form method="post" action="${escapeHtml(confirmPath)}"><input type="hidden" name="orderId" value="${escapeHtml(orderId)}"><input type="hidden" name="token" value="${escapeHtml(confirmToken)}"><button type="submit">Confirm demo payment</button></form>
<p>You may close this page to cancel. No money will be charged.</p></body></html>`;
}

async function sendMomoIpn(environment, order) {
  const responseTime = Date.now();
  const fields = {
    accessKey: environment.momoAccessKey,
    amount: order.amount,
    extraData: '',
    message: 'Demo payment completed',
    orderId: order.orderId,
    orderInfo: order.orderInfo,
    orderType: 'momo_wallet',
    partnerCode: environment.momoPartnerCode,
    payType: 'webApp',
    requestId: order.orderId,
    responseTime,
    resultCode: 0,
    transId: transactionId('momo', order.orderId),
  };
  const body = {
    orderType: fields.orderType,
    amount: fields.amount,
    partnerCode: fields.partnerCode,
    orderId: fields.orderId,
    extraData: fields.extraData,
    signature: hmac('sha256', environment.momoSecretKey, momoCanonical(fields)),
    transId: fields.transId,
    responseTime: fields.responseTime,
    resultCode: fields.resultCode,
    message: fields.message,
    payType: fields.payType,
    requestId: fields.requestId,
    orderInfo: fields.orderInfo,
  };
  const response = await fetch(environment.momoIpnUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status !== 204) throw new Error(`MoMo callback failed (${response.status})`);
}

async function sendVnpayIpn(environment, order) {
  const fields = {
    vnp_Amount: String(order.amount * 100),
    vnp_BankCode: 'DEMO',
    vnp_OrderInfo: order.orderInfo,
    vnp_PayDate: vnpayDate(),
    vnp_ResponseCode: '00',
    vnp_TmnCode: environment.vnpayTmnCode,
    vnp_TransactionNo: transactionId('vnpay', order.orderId),
    vnp_TransactionStatus: '00',
    vnp_TxnRef: order.orderId,
  };
  const url = new URL(environment.vnpayIpnUrl);
  for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  url.searchParams.set(
    'vnp_SecureHash',
    hmac('sha512', environment.vnpayHashSecret, vnpayCanonical(fields)),
  );
  const response = await fetch(url, { method: 'GET', redirect: 'manual' });
  if (response.status !== 200) throw new Error(`VNPAY callback failed (${response.status})`);
}

export function createPaymentDemoServer(environment) {
  const orders = new Map();
  const rateLimiter = createRateLimiter({
    max: environment.rateLimitMax,
    windowMs: environment.rateLimitWindowMs,
  });

  async function settleOrder(order) {
    if (order.settled) return;
    if (order.settling !== null) {
      await order.settling;
      return;
    }
    order.settling = (async () => {
      if (order.provider === 'momo') await sendMomoIpn(environment, order);
      else await sendVnpayIpn(environment, order);
      order.settled = true;
      order.settledAt = new Date().toISOString();
    })();
    try {
      await order.settling;
    } finally {
      order.settling = null;
    }
  }

  async function route(request, response) {
    const requestUrl = new URL(request.url ?? '/', environment.publicOrigin);
    const pathname = requestUrl.pathname;
    const publicRoute = pathname !== '/__internal/order-mapping' && pathname !== '/__health';
    if (publicRoute && !trustedPublicRequest(request, environment)) {
      json(response, 421, { error: 'misdirected request' });
      return;
    }
    if (publicRoute) {
      const limit = rateLimiter.consume(requestClientKey(request));
      if (!limit.allowed) {
        response.setHeader('retry-after', String(limit.retryAfterSeconds));
        json(response, 429, { error: 'rate limit exceeded' });
        return;
      }
    }
    if (pathname === '/__health' && request.method === 'GET') {
      json(response, 200, { ok: true, service: 'payment-demo', orders: orders.size });
      return;
    }
    if (pathname === '/__internal/order-mapping' && request.method === 'POST') {
      const authorization = request.headers.authorization ?? '';
      if (
        !authorization.startsWith('Bearer ') ||
        !sameSecret(environment.controlToken, authorization.slice(7))
      ) {
        json(response, 401, { error: 'unauthorized' });
        return;
      }
      const body = await readJson(request);
      if (
        typeof body.orderId !== 'string' ||
        body.orderId.length === 0 ||
        typeof body.bookingCode !== 'string' ||
        !BOOKING_CODE_PATTERN.test(body.bookingCode)
      ) {
        json(response, 400, { error: 'invalid mapping' });
        return;
      }
      const order = orders.get(body.orderId);
      if (order === undefined) {
        json(response, 404, { error: 'unknown order' });
        return;
      }
      order.bookingCode = body.bookingCode;
      json(response, 200, { ok: true });
      return;
    }
    if (pathname === '/__internal/reconciliation' && request.method === 'GET') {
      const authorization = request.headers.authorization ?? '';
      if (
        !authorization.startsWith('Bearer ') ||
        !sameSecret(environment.controlToken, authorization.slice(7))
      ) {
        json(response, 401, { error: 'unauthorized' });
        return;
      }
      const provider = requestUrl.searchParams.get('provider');
      const orderId = requestUrl.searchParams.get('orderId');
      const order = orderId === null ? undefined : orders.get(orderId);
      if (
        order === undefined ||
        (provider !== 'MOMO' && provider !== 'VNPAY') ||
        order.provider !== provider.toLowerCase()
      ) {
        json(response, 404, { error: 'unknown order' });
        return;
      }
      if (!order.settled) {
        json(response, 200, {
          outcome: 'PENDING',
          providerTransactionId: null,
          amountVnd: null,
          occurredAt: null,
          rawBodyDigest: null,
        });
        return;
      }
      const digest = createHash('sha256')
        .update(`${provider}|${order.orderId}|${order.settledAt}`, 'utf8')
        .digest('base64');
      json(response, 200, {
        outcome: 'SUCCEEDED',
        providerTransactionId: transactionId(order.provider, order.orderId),
        amountVnd: String(order.amount),
        occurredAt: order.settledAt,
        rawBodyDigest: digest,
      });
      return;
    }
    if (pathname === '/v2/gateway/api/create' && request.method === 'POST') {
      const body = await readJson(request);
      const required = [
        'partnerCode',
        'requestId',
        'amount',
        'orderId',
        'orderInfo',
        'redirectUrl',
        'ipnUrl',
        'requestType',
        'extraData',
        'signature',
      ];
      if (
        required.some((key) => !(key in body)) ||
        body.partnerCode !== environment.momoPartnerCode
      ) {
        json(response, 400, { error: 'invalid MoMo create request' });
        return;
      }
      const canonical = momoCanonical({
        accessKey: environment.momoAccessKey,
        amount: body.amount,
        extraData: body.extraData,
        ipnUrl: body.ipnUrl,
        orderId: body.orderId,
        orderInfo: body.orderInfo,
        partnerCode: body.partnerCode,
        redirectUrl: body.redirectUrl,
        requestId: body.requestId,
        requestType: body.requestType,
      });
      if (!sameSecret(hmac('sha256', environment.momoSecretKey, canonical), body.signature)) {
        json(response, 401, { error: 'invalid MoMo signature' });
        return;
      }
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        json(response, 400, { error: 'invalid MoMo amount' });
        return;
      }
      const order = {
        orderId: body.orderId,
        amount,
        orderInfo: String(body.orderInfo),
        bookingCode: bookingCodeFromOrderInfo(body.orderInfo),
        provider: 'momo',
        settled: false,
        settling: null,
      };
      orders.set(order.orderId, order);
      const token = checkoutToken(environment, order);
      const payUrl =
        `${environment.publicOrigin}/momo-test/pay?orderId=${encodeURIComponent(order.orderId)}` +
        `&token=${encodeURIComponent(token)}`;
      const responseFields = {
        partnerCode: environment.momoPartnerCode,
        orderId: order.orderId,
        requestId: body.requestId,
        amount,
        message: 'Demo checkout ready',
        payUrl,
        responseTime: Date.now(),
        resultCode: 0,
      };
      const responseCanonical = momoResponseCanonical({
        accessKey: environment.momoAccessKey,
        ...responseFields,
      });
      json(response, 200, {
        ...responseFields,
        signature: hmac('sha256', environment.momoSecretKey, responseCanonical),
      });
      return;
    }
    if (pathname === '/v2/gateway/api/query' && request.method === 'POST') {
      const body = await readJson(request);
      const canonical = momoCanonical({
        accessKey: environment.momoAccessKey,
        orderId: body.orderId,
        partnerCode: body.partnerCode,
        requestId: body.requestId,
      });
      if (
        body.partnerCode !== environment.momoPartnerCode ||
        !sameSecret(hmac('sha256', environment.momoSecretKey, canonical), body.signature)
      ) {
        json(response, 401, { error: 'invalid MoMo signature' });
        return;
      }
      const order = orders.get(body.orderId);
      const resultCode = order?.settled ? 0 : 9000;
      const result = {
        partnerCode: environment.momoPartnerCode,
        orderId: body.orderId,
        requestId: body.requestId,
        amount: order?.amount ?? 0,
        responseTime: Date.now(),
        message: resultCode === 0 ? 'Success' : 'Pending',
        resultCode,
        ...(resultCode === 0 ? { transId: transactionId('momo', body.orderId) } : {}),
      };
      const responseCanonical = momoCanonical({
        accessKey: environment.momoAccessKey,
        orderId: result.orderId,
        partnerCode: result.partnerCode,
        requestId: result.requestId,
      });
      json(response, 200, {
        ...result,
        signature: hmac('sha256', environment.momoSecretKey, responseCanonical),
      });
      return;
    }
    if (pathname === '/momo-test/pay' && request.method === 'GET') {
      let order;
      try {
        order = resolveCheckoutOrder(orders, environment, requestUrl, 'momo');
      } catch {
        json(response, 404, { error: 'unknown order' });
        return;
      }
      const token = requestUrl.searchParams.get('token');
      const tokenSuffix = token === null ? '' : `&token=${encodeURIComponent(token)}`;
      html(
        response,
        200,
        await checkoutPage({
          provider: 'MoMo',
          orderId: order.orderId,
          amount: order.amount,
          confirmPath: '/momo-test/confirm',
          confirmToken: token,
          checkoutUrl:
            `${environment.publicOrigin}/momo-test/pay?orderId=${encodeURIComponent(order.orderId)}` +
            tokenSuffix,
        }),
        environment.publicOrigin,
      );
      return;
    }
    if (pathname === '/momo-test/confirm' && request.method === 'POST') {
      const form = await readForm(request);
      const confirmationUrl = new URL(request.url ?? '/', environment.publicOrigin);
      for (const key of ['orderId', 'token']) {
        const value = form.get(key);
        if (value !== null) confirmationUrl.searchParams.set(key, value);
      }
      let order;
      try {
        order = requireCheckoutBooking(orders, environment, confirmationUrl, 'momo');
      } catch {
        json(response, 400, { error: 'invalid checkout confirmation' });
        return;
      }
      await settleOrder(order);
      redirect(
        response,
        `${environment.webOrigin}/booking/manage/${encodeURIComponent(order.bookingCode)}`,
      );
      return;
    }
    if (pathname === '/vnpay-test/pay' && request.method === 'GET') {
      const fields = Object.fromEntries(requestUrl.searchParams.entries());
      const canonical = vnpayCanonical(fields);
      if (
        fields.vnp_TmnCode !== environment.vnpayTmnCode ||
        !sameSecret(hmac('sha512', environment.vnpayHashSecret, canonical), fields.vnp_SecureHash)
      ) {
        json(response, 401, { error: 'invalid VNPAY signature' });
        return;
      }
      const amount = Number(fields.vnp_Amount) / 100;
      if (!Number.isSafeInteger(amount) || amount < 1 || !fields.vnp_TxnRef) {
        json(response, 400, { error: 'invalid VNPAY payment request' });
        return;
      }
      const order = {
        orderId: fields.vnp_TxnRef,
        amount,
        orderInfo: fields.vnp_OrderInfo ?? `Room booking ${fields.vnp_TxnRef}`,
        bookingCode: bookingCodeFromOrderInfo(fields.vnp_OrderInfo),
        provider: 'vnpay',
        settled: false,
        settling: null,
      };
      orders.set(order.orderId, order);
      const token = checkoutToken(environment, order);
      html(
        response,
        200,
        await checkoutPage({
          provider: 'VNPAY',
          orderId: order.orderId,
          amount: order.amount,
          confirmPath: '/vnpay-test/confirm',
          confirmToken: token,
          checkoutUrl: `${environment.publicOrigin}${requestUrl.pathname}${requestUrl.search}`,
        }),
        environment.publicOrigin,
      );
      return;
    }
    if (pathname === '/vnpay-test/confirm' && request.method === 'POST') {
      const form = await readForm(request);
      const confirmationUrl = new URL(request.url ?? '/', environment.publicOrigin);
      for (const key of ['orderId', 'token']) {
        const value = form.get(key);
        if (value !== null) confirmationUrl.searchParams.set(key, value);
      }
      let order;
      try {
        order = requireCheckoutBooking(orders, environment, confirmationUrl, 'vnpay');
      } catch {
        json(response, 400, { error: 'invalid checkout confirmation' });
        return;
      }
      await settleOrder(order);
      redirect(
        response,
        `${environment.webOrigin}/booking/manage/${encodeURIComponent(order.bookingCode)}`,
      );
      return;
    }
    if (
      pathname === '/vnpay-test/pay/merchant_webapi/api/transaction' &&
      request.method === 'POST'
    ) {
      const form = Object.fromEntries((await readForm(request)).entries());
      const canonical = vnpayCanonical(form);
      if (
        form.vnp_TmnCode !== environment.vnpayTmnCode ||
        !sameSecret(hmac('sha512', environment.vnpayHashSecret, canonical), form.vnp_SecureHash)
      ) {
        json(response, 401, { error: 'invalid VNPAY signature' });
        return;
      }
      const order = orders.get(form.vnp_TxnRef);
      const success = order?.settled === true;
      const result = {
        vnp_ResponseCode: success ? '00' : '99',
        vnp_TmnCode: environment.vnpayTmnCode,
        vnp_TxnRef: form.vnp_TxnRef ?? '',
        vnp_Amount: String((order?.amount ?? 0) * 100),
        vnp_Message: success ? 'Success' : 'Pending',
        ...(success
          ? {
              vnp_TransactionNo: transactionId('vnpay', order.orderId),
              vnp_TransactionStatus: '00',
            }
          : {}),
      };
      json(response, 200, {
        ...result,
        vnp_SecureHash: hmac('sha512', environment.vnpayHashSecret, vnpayCanonical(result)),
      });
      return;
    }
    json(response, 404, { error: 'not found' });
  }

  return createServer((request, response) => {
    void route(request, response).catch((error) => {
      json(response, 500, { error: error instanceof Error ? error.message : 'internal error' });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environment = loadEnvironment();
  const server = createPaymentDemoServer(environment);
  server.listen(environment.port, environment.host, () => {
    process.stdout.write(`[payment-demo] listening on ${environment.host}:${environment.port}\n`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
