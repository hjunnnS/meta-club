import express from 'express';
import { ExpressAuth } from '@auth/express';
import { isOperator, requireOperator } from './operator.js';
import { readSession } from './session.js';
import { auth, origin } from './auth.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((req, res, next) => {
  if (req.get('host') !== origin.host || req.protocol !== 'https') {
    return res.sendStatus(400);
  }
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.use(/^\/auth\/(.+)$/, ExpressAuth(auth));

function page(title, content) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · 메타 클럽</title><main><h1>${title}</h1>${content}</main></html>`;
}

app.use(async (req, res, next) => {
  res.locals.session = await readSession(req, auth.secret);
  next();
});

app.get('/api/session', (_req, res) => {
  res.json(res.locals.session);
});

app.get('/', (_req, res) => {
  const session = res.locals.session;
  if (session?.user?.id) {
    const operatorLink = isOperator(session) ? '<p><a href="/operator">운영자 공간</a></p>' : '';
    return res.send(page('메타 클럽', '<p>로그인되었습니다.</p>' + operatorLink + '<a href="/auth/signout">로그아웃</a>'));
  }
  res.send(page('메타 클럽', '<a href="/auth/signin?callbackUrl=%2F">Google 또는 Apple로 로그인</a>'));
});

// The lobby and channel admission implementations can share this server policy.
app.get('/api/access', (_req, res) => {
  const session = res.locals.session;
  res.json({
    role: session?.user?.id ? 'member' : 'guest',
    lobby: { view: true },
    club: { enter: true },
  });
});

app.use('/api/account', (_req, res, next) => {
  const session = res.locals.session;
  if (!session?.user?.id) return res.status(401).json({ error: session.reason });
  res.locals.account = session.user;
  next();
});
app.get('/api/account', (_req, res) => res.json(res.locals.account));

app.use(['/operator', '/api/operator'], requireOperator);
app.get('/operator', (_req, res) => {
  res.send(page('운영자 공간', '<p>운영자 계정으로 로그인했습니다.</p><a href="/">메타 클럽으로 돌아가기</a>'));
});
app.get('/api/operator', (_req, res) => res.json({ role: 'operator' }));

app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
