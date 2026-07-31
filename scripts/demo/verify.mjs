#!/usr/bin/env node
// scripts/demo/verify.mjs
//
// Deterministic local-demo verifier. Runs a sequence of checks against
// the local web (3000), API (3001), Mailpit (8025) and payment
// simulator (3090) using canonical browser origins (`localhost`).
// Used by `pnpm demo:verify` and the smoke gate.

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001';
const MAILPIT = 'http://localhost:8025';
const SIMULATOR = 'http://localhost:3090';
const ADMIN_EMAIL = 'demo-verify@room.local';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' :: ' + detail : ''}`);
}

async function tryFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(5000) });
    return { ok: r.ok, status: r.status, body: await r.text().catch(() => '') };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  }
}

async function main() {
  // INFRA
  console.log('\n--- INFRA ---');
  const live = await tryFetch(API + '/api/v1/health/live');
  record('infra.api.live', live.ok && live.status === 200, `status=${live.status}`);

  const ready = await tryFetch(API + '/api/v1/health/ready');
  record('infra.api.ready', ready.ok && ready.status === 200, `status=${ready.status}`);

  const web = await tryFetch(WEB + '/');
  record('infra.web.reachable', web.ok && web.status === 200, `status=${web.status}`);

  const mailpit = await tryFetch(MAILPIT + '/api/v1/messages');
  record('infra.mailpit.ready', mailpit.ok && mailpit.status === 200, `status=${mailpit.status}`);

  const simHealth = await tryFetch(SIMULATOR + '/__health');
  record(
    'infra.simulator.ready',
    simHealth.ok && simHealth.status === 200,
    `status=${simHealth.status}`,
  );

  // CUSTOMER
  console.log('\n--- CUSTOMER ---');
  const roomTypes = await tryFetch(API + '/api/v1/public/room-types');
  let rtOk = false;
  let rtCount = 0;
  if (roomTypes.ok) {
    try {
      const body = JSON.parse(roomTypes.body);
      const items = body.items ?? body;
      rtCount = Array.isArray(items) ? items.length : 0;
      const names = (Array.isArray(items) ? items : []).map((i) => i.name);
      rtOk =
        rtCount === 3 &&
        names.includes('Standard') &&
        names.includes('Deluxe') &&
        names.includes('Signature');
    } catch {}
  }
  record('customer.public.room-types', rtOk, `count=${rtCount}`);

  const search = await tryFetch(WEB + '/rooms');
  record('customer.search.opens', search.ok && search.status === 200, `status=${search.status}`);

  const providers = await tryFetch(API + '/api/v1/public/payment-providers');
  let providersOk = false;
  let providerNames = [];
  if (providers.ok) {
    try {
      const body = JSON.parse(providers.body);
      providerNames = body.map((p) => p.provider);
      providersOk = providerNames.includes('MOMO') && providerNames.includes('VNPAY');
    } catch {}
  }
  record('customer.payment-providers', providersOk, `providers=${providerNames.join(',')}`);

  // ADMIN
  console.log('\n--- ADMIN ---');
  // Use the API directly to login via the canonical loopback origin so
  // the Set-Cookie path matches what browser users get on `localhost`.
  const signinRaw = await fetch(API + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB,
    },
    body: JSON.stringify({
      email: process.env.VERIFY_ADMIN_EMAIL ?? ADMIN_EMAIL,
      password: process.env.VERIFY_ADMIN_PASSWORD ?? 'Aa1-KnownVerifyPass-1234',
    }),
  });
  const setCookies = signinRaw.headers.getSetCookie();
  const sessionCookie = setCookies.find((c) => c.startsWith('better-auth.session_token='));
  record(
    'admin.login.post',
    signinRaw.ok && !!sessionCookie,
    `status=${signinRaw.status} cookieSet=${!!sessionCookie}`,
  );

  if (sessionCookie) {
    const cookieHeader = sessionCookie.split(';')[0];
    const me = await tryFetch(API + '/api/v1/admin/me', {
      headers: { cookie: cookieHeader },
    });
    record('admin.me.after_login', me.ok && me.status === 200, `status=${me.status}`);

    for (const path of [
      '/admin',
      '/admin/bookings',
      '/admin/rooms',
      '/admin/room-types',
      '/admin/payment-providers',
    ]) {
      const p = await tryFetch(WEB + path, {
        headers: { cookie: cookieHeader },
        redirect: 'manual',
      });
      // /admin/login may 307 because unauth; with cookie it should 200
      const ok = p.status === 200;
      record(`admin.page.${path}`, ok, `status=${p.status}`);
    }
  }

  // SECURITY
  console.log('\n--- SECURITY ---');
  const forged = await tryFetch(
    API + '/api/v1/payments/providers/momo/return?orderId=forged-1&resultCode=0&signature=deadbeef',
  );
  // Forged signature should not be 200
  const forgedDenied = !forged.ok || forged.status !== 200;
  record('security.forged_return_denied', forgedDenied, `status=${forged.status}`);

  // SUMMARY
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== ${passed}/${results.length} passed ===`);
  if (failed > 0) {
    console.log(
      `FAILED: ${results
        .filter((r) => !r.ok)
        .map((r) => r.name)
        .join(', ')}`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('verifier error:', err);
  process.exit(1);
});
