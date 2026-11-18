import { randomUUID } from 'node:crypto';
import { encode } from '@auth/core/jwt';
import { readSession, sessionCookie } from './session.js';
import { sharedAutoEntry, sharedTrialActive, sharedTrialExpiry } from './shared-trial.js';

// Public URL-only trial entry. Each browser gets its own signed identity; never
// reuse one of the three invitation accounts or enable this in ordinary auth.
export function sharedAutoEntryMiddleware(secret) {
  return async (req, res, next) => {
    if (!sharedAutoEntry || req.method !== 'GET' || !['/', '/clubs/edm', '/clubs/edm/', '/auth/signin'].includes(req.path)) return next();
    if (!sharedTrialActive()) return res.status(410).send('공동 시험 기간이 종료되었습니다.');
    const session = await readSession(req, secret);
    if (session.status !== 'authenticated') {
      const maxAge = Math.max(1, Math.floor((sharedTrialExpiry() - Date.now()) / 1000));
      const token = await encode({secret, salt:sessionCookie, maxAge, token:{sub:'local-test:shared-auto-'+randomUUID()}});
      res.cookie(sessionCookie, token, {httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge:maxAge*1000});
      return res.redirect(303, '/clubs/edm');
    }
    if (req.path === '/' || req.path === '/auth/signin') return res.redirect(303, '/clubs/edm');
    next();
  };
}
