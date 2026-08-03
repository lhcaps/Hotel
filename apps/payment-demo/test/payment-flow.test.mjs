/* global URL, URLSearchParams */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { createServer, request } from 'node:http';
import test from 'node:test';

import { createPaymentDemoServer, loadEnvironment } from '../main.mjs';

function hmac(secret, text, algorithm = 'sha256') {
  return createHmac(algorithm, secret).update(text, 'utf8').digest('hex');
}

function extractFormAction(html) {
  const match = /<form method="post" action="([^"]+)">/u.exec(html);
  assert.ok(match?.[1], 'checkout page must contain a POST confirmation action');
  return match[1].replaceAll('&amp;', '&');
}

function vnpayCanonical(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    params.append(key, value);
  }
  return params.toString();
}

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port)),
  );
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function send(port, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: { host: 'payments.example.test', ...headers },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.end(body);
    else req.end();
  });
}

test('requires a private token to map an order, then settles and redirects a MoMo demo payment', async () => {
  const callbacks = [];
  const callbackServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    callbacks.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8') });
    res.statusCode = 204;
    res.end();
  });
  const callbackPort = await listen(callbackServer);
  const environment = loadEnvironment({
    PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.example.test',
    PAYMENT_DEMO_WEB_ORIGIN: 'https://example.test',
    PAYMENT_DEMO_MOMO_IPN_URL: `http://127.0.0.1:${callbackPort}/api/v1/webhooks/momo`,
    PAYMENT_DEMO_VNPAY_IPN_URL: `http://127.0.0.1:${callbackPort}/api/v1/webhooks/vnpay`,
    PAYMENT_DEMO_CONTROL_TOKEN: 'a-demo-control-token-that-is-at-least-32-characters',
    MOMO_PARTNER_CODE: 'DEMO_MOMO',
    MOMO_ACCESS_KEY: 'demo-momo-access',
    MOMO_SECRET_KEY: 'demo-momo-secret-key-that-is-at-least-32-characters',
    VNPAY_TMN_CODE: 'DEMOVNPAY',
    VNPAY_HASH_SECRET: 'demo-vnpay-hash-secret-that-is-at-least-32-characters',
  });
  const service = createPaymentDemoServer(environment);
  const port = await listen(service);
  try {
    const body = {
      partnerCode: environment.momoPartnerCode,
      requestId: 'order-001',
      amount: 750000,
      orderId: 'order-001',
      orderInfo: 'Room booking BOOK-001',
      redirectUrl: 'https://example.test/return',
      ipnUrl: 'https://example.test/ipn',
      requestType: 'captureWallet',
      extraData: '',
    };
    const canonical = [
      `accessKey=${environment.momoAccessKey}`,
      `amount=${body.amount}`,
      `extraData=${body.extraData}`,
      `ipnUrl=${body.ipnUrl}`,
      `orderId=${body.orderId}`,
      `orderInfo=${body.orderInfo}`,
      `partnerCode=${body.partnerCode}`,
      `redirectUrl=${body.redirectUrl}`,
      `requestId=${body.requestId}`,
      `requestType=${body.requestType}`,
    ].join('&');
    const created = await send(port, 'POST', '/v2/gateway/api/create', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, signature: hmac(environment.momoSecretKey, canonical) }),
    });
    assert.equal(created.status, 200);
    const checkout = JSON.parse(created.body);
    assert.match(checkout.payUrl, /^https:\/\/payments\.example\.test\/momo-test\/pay/);

    const rejected = await send(port, 'POST', '/__internal/order-mapping', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-001', bookingCode: 'BOOK-001' }),
    });
    assert.equal(rejected.status, 401);
    const mapped = await send(port, 'POST', '/__internal/order-mapping', {
      headers: {
        authorization: `Bearer ${environment.controlToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ orderId: 'order-001', bookingCode: 'BOOK-001' }),
    });
    assert.equal(mapped.status, 200);

    const checkoutUrl = new URL(checkout.payUrl);
    assert.ok(checkoutUrl.searchParams.get('token'), 'MoMo demo URL must carry a signed token');
    const checkoutPage = await send(port, 'GET', `${checkoutUrl.pathname}${checkoutUrl.search}`);
    assert.equal(checkoutPage.status, 200);
    assert.match(checkoutPage.body, /alt="Payment QR code"/u);
    assert.match(checkoutPage.body, /data:image\/png;base64,/u);
    const confirmationPath = extractFormAction(checkoutPage.body);

    const confirmed = await send(port, 'POST', confirmationPath);
    assert.equal(confirmed.status, 303);
    assert.equal(confirmed.headers.location, 'https://example.test/booking/manage/BOOK-001');
    assert.equal(callbacks.length, 1);
    assert.match(callbacks[0].body, /"signature":"[a-f0-9]{64}"/);

    const duplicate = await send(port, 'POST', confirmationPath);
    assert.equal(duplicate.status, 303);
    assert.equal(callbacks.length, 1, 'a duplicate browser confirmation must not re-send the IPN');

    const reconciled = await send(
      port,
      'GET',
      '/__internal/reconciliation?provider=MOMO&orderId=order-001',
      { headers: { authorization: `Bearer ${environment.controlToken}` } },
    );
    assert.equal(reconciled.status, 200);
    assert.match(reconciled.body, /"outcome":"SUCCEEDED"/);
  } finally {
    await close(service);
    await close(callbackServer);
  }
});

test('rate limits public payment routes without exposing secrets', async () => {
  const environment = loadEnvironment({
    PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.example.test',
    PAYMENT_DEMO_WEB_ORIGIN: 'https://example.test',
    PAYMENT_DEMO_MOMO_IPN_URL: 'http://127.0.0.1:9/momo',
    PAYMENT_DEMO_VNPAY_IPN_URL: 'http://127.0.0.1:9/vnpay',
    PAYMENT_DEMO_CONTROL_TOKEN: 'a-demo-control-token-that-is-at-least-32-characters',
    MOMO_PARTNER_CODE: 'DEMO_MOMO',
    MOMO_ACCESS_KEY: 'demo-momo-access',
    MOMO_SECRET_KEY: 'demo-momo-secret-key-that-is-at-least-32-characters',
    VNPAY_TMN_CODE: 'DEMOVNPAY',
    VNPAY_HASH_SECRET: 'demo-vnpay-hash-secret-that-is-at-least-32-characters',
    PAYMENT_DEMO_RATE_LIMIT_MAX: '1',
    PAYMENT_DEMO_RATE_LIMIT_WINDOW_MS: '1000',
  });
  const service = createPaymentDemoServer(environment);
  const port = await listen(service);
  try {
    const first = await send(port, 'GET', '/not-found');
    assert.equal(first.status, 404);
    const limited = await send(port, 'GET', '/not-found');
    assert.equal(limited.status, 429);
    assert.equal(limited.headers['retry-after'], '1');
    assert.doesNotMatch(limited.body, /secret|token|signature/i);
  } finally {
    await close(service);
  }
});

test('reconstructs a signed VNPAY booking mapping after payment-demo restart', async () => {
  const callbacks = [];
  const callbackServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    callbacks.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8') });
    res.statusCode = req.url?.startsWith('/api/v1/webhooks/vnpay') ? 200 : 204;
    res.end('{}');
  });
  const callbackPort = await listen(callbackServer);
  const environment = loadEnvironment({
    PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.example.test',
    PAYMENT_DEMO_WEB_ORIGIN: 'https://example.test',
    PAYMENT_DEMO_MOMO_IPN_URL: `http://127.0.0.1:${callbackPort}/api/v1/webhooks/momo`,
    PAYMENT_DEMO_VNPAY_IPN_URL: `http://127.0.0.1:${callbackPort}/api/v1/webhooks/vnpay`,
    PAYMENT_DEMO_CONTROL_TOKEN: 'a-demo-control-token-that-is-at-least-32-characters',
    MOMO_PARTNER_CODE: 'DEMO_MOMO',
    MOMO_ACCESS_KEY: 'demo-momo-access',
    MOMO_SECRET_KEY: 'demo-momo-secret-key-that-is-at-least-32-characters',
    VNPAY_TMN_CODE: 'DEMOVNPAY',
    VNPAY_HASH_SECRET: 'demo-vnpay-hash-secret-that-is-at-least-32-characters',
  });
  const fields = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: environment.vnpayTmnCode,
    vnp_Amount: '48900000',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: 'VNPAY-order-001',
    vnp_OrderInfo: 'Room booking BOOK-VNPAY-001',
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: 'https://example.test/api/v1/payments/providers/vnpay/return',
    vnp_CreateDate: '20260803230000',
    vnp_ExpireDate: '20260804010000',
  };
  const canonical = vnpayCanonical(fields);
  const params = new URLSearchParams(canonical);
  params.set('vnp_SecureHash', hmac(environment.vnpayHashSecret, canonical, 'sha512'));

  let service = createPaymentDemoServer(environment);
  let port = await listen(service);
  try {
    const checkout = await send(port, 'GET', `/vnpay-test/pay?${params.toString()}`);
    assert.equal(checkout.status, 200);
    const confirmationPath = extractFormAction(checkout.body);
    assert.match(confirmationPath, /token=/u);

    await close(service);
    service = createPaymentDemoServer(environment);
    port = await listen(service);

    const confirmed = await send(port, 'POST', confirmationPath);
    assert.equal(confirmed.status, 303);
    assert.equal(confirmed.headers.location, 'https://example.test/booking/manage/BOOK-VNPAY-001');
    assert.equal(callbacks.length, 1);
    assert.match(callbacks[0].url ?? '', /vnp_TxnRef=VNPAY-order-001/u);
  } finally {
    if (service.listening) await close(service);
    await close(callbackServer);
  }
});
