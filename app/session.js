import { decode, getToken } from '@auth/core/jwt';

export const sessionCookie = '__Secure-authjs.session-token';

// Auth.js also decodes temporary OAuth cookies. Only the session cookie
// contains account claims and uses the strict application expiry boundary.
export async function decodeSession(params) {
  const token = await decode(params);
  if (!token || params.salt !== sessionCookie) return token;
  if (!Number.isSafeInteger(token.exp) || typeof token.sub !== 'string' || !token.sub) {
    throw new Error('Invalid session claims');
  }
  if (token.exp <= Math.floor(Date.now() / 1000)) {
    const error = new Error('Session expired');
    error.code = 'ERR_JWT_EXPIRED';
    throw error;
  }
  return token;
}

export async function readSession(req, secret) {
  // Forward only cookies. Auth.js joins numbered chunks for large tokens.
  const raw = await getToken({
    req: { headers: { cookie: req.headers.cookie ?? '' } },
    cookieName: sessionCookie,
    raw: true,
  });
  if (!raw) return { status: 'guest', reason: 'login_required' };
  try {
    const token = await decodeSession({ token: raw, secret, salt: sessionCookie });
    return {
      status: 'authenticated',
      user: { id: token.sub },
      expires: new Date(token.exp * 1000).toISOString(),
    };
  } catch (error) {
    const expired = error.code === 'ERR_JWT_EXPIRED';
    return { status: 'guest', reason: expired ? 'session_expired' : 'session_invalid' };
  }
}
