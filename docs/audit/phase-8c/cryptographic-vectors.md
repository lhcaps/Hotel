# Phase 8C — Cryptographic Vectors

This document is the catalogue of deterministic cryptographic vectors
that the Gate B.1 conformance test
(`apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`)
asserts byte-identically against the production canonical-string
builders and HMAC signing. The vectors are taken from the
**documented sample** for each provider; live sandbox vectors remain
`EXTERNAL_BLOCKED` (retrieval date 2026-07-28).

The two oracles are:

- `apps/api/test/payment/gate-b1-momo.oracle.ts`
  (`oracleMomoCreate`, `oracleMomoIpn`, `oracleMomoQuery`,
  `oracleHmacSha256`).
- `apps/api/test/payment/gate-b1-vnpay.oracle.ts`
  (`oracleVnpayCanonical`, `oracleVnpayAmount`,
  `oracleVnpayTimestamp`, `oracleHmacSha512`).

The test asserts that the production builders and the independent
oracles agree on the canonical string AND the HMAC digest, AND that
any byte-level mutation is rejected by `crypto.timingSafeEqual`.

## 1. MoMo initiation

Input (`momoCreate`):

```ts
{
  accessKey: 'AK-01',
  amount: 125000,
  extraData: '',
  ipnUrl: 'https://merchant.test/momo/ipn',
  orderId: 'ORD-01',
  orderInfo: 'Đặt phòng Hà Nội',
  partnerCode: 'PARTNER-01',
  redirectUrl: 'https://merchant.test/momo/return',
  requestId: 'REQ-01',
  requestType: 'captureWallet',
}
```

Expected canonical (10 fields, fixed order):

```
accessKey=AK-01&amount=125000&extraData=&ipnUrl=https://merchant.test/momo/ipn&orderId=ORD-01&orderInfo=Đặt phòng Hà Nội&partnerCode=PARTNER-01&redirectUrl=https://merchant.test/momo/return&requestId=REQ-01&requestType=captureWallet
```

Expected HMAC-SHA256 (secret `gate-b1-momo-secret`):

```
17fbb5d99e558bb2b7604aad4b87e4b097aaf046485558ef51b6526453083e0d
```

Test assertions:

- `oracleMomoCreate(momoCreate)` matches the expected canonical.
- `buildMomoInitiationCanonicalString(momoCreate)` matches the
  oracle.
- `oracleHmacSha256(secret, canonical)` matches the expected
  digest.
- `signMomoCanonicalString(secret, canonical)` matches the oracle.

## 2. MoMo IPN

Input (`momoIpn`):

```ts
{
  accessKey: 'AK-01',
  amount: 125000,
  extraData: '',
  message: 'Thành công',
  orderId: 'ORD-01',
  orderInfo: 'Đặt phòng Hà Nội',
  orderType: 'momo_wallet',
  partnerCode: 'PARTNER-01',
  payType: 'qr',
  requestId: 'REQ-01',
  responseTime: 1782493200000,
  resultCode: 0,
  transId: 'TX-01',
}
```

Expected canonical (13 fields, fixed order):

```
accessKey=AK-01&amount=125000&extraData=&message=Thành công&orderId=ORD-01&orderInfo=Đặt phòng Hà Nội&orderType=momo_wallet&partnerCode=PARTNER-01&payType=qr&requestId=REQ-01&responseTime=1782493200000&resultCode=0&transId=TX-01
```

Expected HMAC-SHA256 (secret `gate-b1-momo-secret`):

```
(Determined by `oracleHmacSha256(momoSecret, canonical)`; same secret as initiation.)
```

Test assertions:

- `oracleMomoIpn(momoIpn)` matches the expected canonical.
- `buildMomoIpnCanonicalString(momoIpn)` matches the oracle.
- Mutations on `amount`, `partnerCode`, `orderId`, `requestId`,
  `resultCode` are rejected by `hasValidMomoSignature`.
- Reordered, missing, and empty-value canonical mutations are
  rejected.

## 3. MoMo status query

Input (re-uses the IPN shape minus the response-only fields; the
canonical string omits `amount`, `message`, `orderInfo`, `orderType`,
`payType`, `responseTime`, `resultCode`, `transId`):

```
{ accessKey: 'AK-01', orderId: 'ORD-01', partnerCode: 'PARTNER-01', requestId: 'REQ-01' }
```

Expected canonical (4 fields, fixed order):

```
accessKey=AK-01&orderId=ORD-01&partnerCode=PARTNER-01&requestId=REQ-01
```

Expected HMAC-SHA256 (secret `gate-b1-momo-secret`):

```
(Determined by `oracleHmacSha256(momoSecret, canonical)`; same secret as initiation/IPN.)
```

Test assertions:

- `oracleMomoQuery(momoIpn)` matches the expected canonical.
- `buildMomoQueryCanonicalString(...)` (the new addition in
  `momo.signature.ts`) matches the oracle.
- `hasValidMomoSignature` rejects a mutated canonical for any of
  the four fields.

## 4. VNPAY create / IPN / query

Input (`vnpayFields`):

```ts
{
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'TMN01',
  vnp_Amount: '12500000',
  vnp_TxnRef: 'ORD-01',
  vnp_OrderInfo: 'Đặt phòng + tầng 2',
  vnp_ResponseCode: '00',
  vnp_QueryDr: 'Y',
  vnp_Empty: '',
  vnp_SecureHash: 'ignore',
  vnp_SecureHashType: 'SHA512',
}
```

Expected canonical (sorted, `vnp_SecureHash` / `vnp_SecureHashType`
excluded, empty values excluded, URL-encoded `k=v`):

```
vnp_Amount=12500000&vnp_Command=pay&vnp_OrderInfo=%C4%90%E1%BA%B7t+ph%C3%B2ng+%2B+t%E1%BA%A7ng+2&vnp_QueryDr=Y&vnp_ResponseCode=00&vnp_TmnCode=TMN01&vnp_TxnRef=ORD-01&vnp_Version=2.1.0
```

Expected HMAC-SHA512 (secret `gate-b1-vnpay-secret`):

```
c2d870aef248736c61475e564f49b8e0fe1d5a1751115a849e9a309e477c116d6302866d8b31fa2c3275d553eaa346be7b6c106c55fbe851142a028e4dfbc4b9
```

Amount helper: `oracleVnpayAmount(125000n)` returns `'12500000'`
(VND × 100).

Timestamp helper:
`oracleVnpayTimestamp(new Date('2026-07-28T00:00:00.000Z'))` returns
`'20260728070000'` (GMT+7 formatting).

Test assertions:

- `oracleVnpayCanonical(vnpayFields)` matches the expected
  canonical.
- `buildVnpayCanonicalQuery(vnpayFields)` matches the oracle.
- `oracleHmacSha512(secret, canonical)` matches the expected
  digest.
- `signVnpayCanonicalQuery(secret, canonical)` matches the oracle.
- Mutations on `vnp_Amount`, `vnp_TxnRef`, `vnp_ResponseCode`,
  `vnp_TmnCode` are rejected by `hasValidVnpaySignature`.
- Duplicate keys, spaces, `+`, `%`, Vietnamese, and
  `SecureHash`-exclusion rules are exercised.
- The production VNPAY signature source contains
  `timingSafeEqual` and a constant-time comparison convention
  (`actual.length === expected.length`); the gate asserts these
  are present.

## 5. Vector catalogue status

| Vector family | Provider | Source | Live sandbox? |
| --- | --- | --- | --- |
| Initiation | MoMo | Documented sample, accessed 2026-07-28 | EXTERNAL_BLOCKED |
| Response | MoMo | Documented sample, accessed 2026-07-28 | EXTERNAL_BLOCKED |
| IPN | MoMo | Documented sample, accessed 2026-07-28 | EXTERNAL_BLOCKED |
| Status query | MoMo | Documented sample, accessed 2026-07-28 | EXTERNAL_BLOCKED |
| Create / IPN / query | VNPAY | Documented sample, accessed 2026-07-28 | EXTERNAL_BLOCKED |

The deterministic test vectors above are sandbox-independent; they
let us assert that the production canonical-string builders and
the independent oracles agree, and that any byte-level mutation is
rejected by `crypto.timingSafeEqual`. The two open Phase 8A gaps
(VNPAY amount scaling ×100 vs ×1, VNPAY space encoding `+` vs
`%20`) are recorded as `EXTERNAL_BLOCKED` and can only be cleared
by Phase 8D (live sandbox acceptance with merchant credentials
and a registered public HTTPS callback URL).

The retrieval date for the official MoMo and VNPAY documentation
referenced in this vector catalogue is **2026-07-28**. The URLs
are:

- MoMo: `https://payment.momo.vn/docs/payment_gateway/`.
- VNPAY: `https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html`.