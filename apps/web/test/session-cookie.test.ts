import { rewriteSessionCookie } from '../src/lib/session-cookie';

describe('rewriteSessionCookie', () => {
  it('forwards the production secure Better Auth cookie', () => {
    expect(
      rewriteSessionCookie(
        '__Secure-better-auth.session_token=token; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax',
      ),
    ).toBe(
      '__Secure-better-auth.session_token=token; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800',
    );
  });

  it('continues forwarding the non-secure test cookie', () => {
    expect(
      rewriteSessionCookie('better-auth.session_token=token; Path=/; HttpOnly; SameSite=Lax'),
    ).toBe('better-auth.session_token=token; Path=/; HttpOnly; SameSite=Lax');
  });

  it('ignores unrelated cookies', () => {
    expect(rewriteSessionCookie('other=value; Path=/')).toBeNull();
  });
});
