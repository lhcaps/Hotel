import { describe, expect, it } from 'vitest';

import { renderAccessCredentialDelivery } from '../../src/email/templates/access-credential-delivery.js';

describe('access credential delivery template', () => {
  it('renders a Vietnamese-first T-30 package without provider references', () => {
    const rendered = renderAccessCredentialDelivery({
      bookingCode: 'PN-ABCD-1234',
      propertyName: 'PeaceNest Riverside',
      qrCid: 'peacenest-check-in-test@mail',
      arrival: {
        gatePass: 'GATE-1234',
        roomPass: 'ROOM-5678',
        wifiSsid: 'PeaceNest Guest',
        wifiPassword: 'wifi-test-password',
        roomLocation: 'Tầng 3',
        instructions: 'Đi thang máy lên tầng 3.',
        preparationNote: 'Chuẩn bị giấy tờ tuỳ thân.',
        supportContact: '0900 000 000',
      },
    });
    const joined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;

    expect(rendered.subject).toContain('PeaceNest');
    expect(joined).toContain('GATE-1234');
    expect(joined).toContain('ROOM-5678');
    expect(joined).toContain('PeaceNest Guest');
    expect(rendered.html).toContain('cid:peacenest-check-in-test@mail');
    expect(joined).not.toMatch(/provider[_ -]?reference/i);
  });

  it('escapes untrusted arrival text in the HTML representation', () => {
    const rendered = renderAccessCredentialDelivery({
      bookingCode: 'PN-ABCD-1234',
      propertyName: 'PeaceNest',
      arrival: {
        gatePass: '<script>alert(1)</script>',
        roomPass: 'ROOM-5678',
        wifiSsid: 'Guest',
        wifiPassword: 'password',
        roomLocation: 'Tầng 3',
        instructions: 'Hướng dẫn',
        preparationNote: 'Lưu ý',
        supportContact: '0900',
      },
    });

    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<script>');
  });
});
