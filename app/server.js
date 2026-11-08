import express from 'express';
import { ExpressAuth, getSession } from '@auth/express';
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

app.get('/', async (req, res) => {
  const session = await getSession(req, auth);
  if (session?.user?.id) {
    return res.send(page('메타 클럽', '<p>로그인되었습니다.</p><a href="/auth/signout">로그아웃</a>'));
  }
  res.send(page('메타 클럽', '<a href="/auth/signin?callbackUrl=%2F">Google 또는 Apple로 로그인</a>'));
});

app.use('/api/account', async (req, res, next) => {
  const session = await getSession(req, auth);
  if (!session?.user?.id) return res.status(401).json({ error: 'login_required' });
  res.locals.account = session.user;
  next();
});
app.get('/api/account', (_req, res) => res.json(res.locals.account));

app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
