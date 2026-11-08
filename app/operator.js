// Account IDs are provider-scoped subjects from the verified Auth.js session.
const accounts = new Set((process.env.OPERATOR_ACCOUNT_IDS ?? '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean));

export function isOperator(session) {
  return session.status === 'authenticated' && accounts.has(session.user.id);
}

export function requireOperator(req, res, next) {
  const session = res.locals.session;
  if (isOperator(session)) return next();

  const authenticated = session.status === 'authenticated';
  const status = authenticated ? 403 : 401;
  const reason = authenticated ? 'operator_required' : session.reason;
  console.warn(JSON.stringify({
    event: 'operator_access_denied',
    time: new Date().toISOString(),
    area: req.baseUrl,
    method: req.method,
    accountId: authenticated ? session.user.id : null,
    status,
    reason,
  }));
  return res.status(status).json({ error: reason });
}
