import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { capacity, seatSeconds, pending, connected, recent, rooms, EdmRoom } from './club-room.js';
import { avatars, profile, saveProfile, reports, decisions, moderate } from './store.js';
import { installShop } from './shop.js';
import { installMusic } from './music.js';
import express from 'express';
import { localTest } from './local-test.js';

import { readSession } from './session.js';

const guestCookie = '__Host-club-guest';
function reserve(identity, channelId, expires) {
  const active = connected.get(identity);
  if (active && (!channelId || active.room.roomId === channelId))
    return { status: 'already_joined', ...active.room.population() };
  const existing = pending.get(identity);
  if (existing) return existing.channelId === channelId ? existing.request : { status: 'busy' };
  const options = { identity, expires, transfer: Boolean(active), restore: false };
  const preferred = channelId || recent.get(identity)?.room;
  async function assign() {
    if (preferred && rooms.has(preferred)) {
      options.restore = !channelId;
      try {
        return await matchMaker.joinById(preferred, options);
      } catch (error) {
        if (channelId) throw error;
      }
    } else if (channelId) throw Error('channel unavailable');
    options.restore = false;
    return matchMaker.joinOrCreate('edm', options);
  }
  const entry = { channelId };
  const clear = () => {
    if (pending.get(identity) === entry) pending.delete(identity);
  };
  entry.request = assign()
    .then((seat) => {
      setTimeout(clear, seatSeconds * 1000).unref();
      const { name, roomId, processId } = seat.room;
      return {
        status: 'reserved',
        seat: { sessionId: seat.sessionId, room: { name, roomId, processId } },
      };
    })
    .catch((error) => {
      clear();
      throw error;
    });
  pending.set(identity, entry);
  return entry.request;
}

export async function startChannels(app, { origin, secret, port }) {
  const hiphop = localTest ? await import('./hiphop-room.js') : null;
  const social = localTest ? await import('./social-room.js') : null;
  const retro = localTest ? await import('./retro-room.js') : null;
  const serveFile = (relative) => (_req, res) =>
    res.sendFile(fileURLToPath(new URL(relative, import.meta.url)));
  app.use(express.json({ limit: '8kb' }));
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.get('origin') !== origin.origin) return res.sendStatus(403);
    next();
  });
  app.use('/clubs/edm', cookieParser(secret));
  installMusic(app);
  installShop(app);
  app.get('/clubs/edm/shop.js', serveFile('./public/shop.js'));
  const channelList = () => [...rooms.values()].map((r) => r.population());
  app.get('/api/operator/channels', (_req, res) => res.json(channelList()));
  app.post('/api/operator/channels/:id/event-tier', (req, res) => {
    const tier = req.body?.tier;
    if (![0, 1, 2].includes(tier)) return res.sendStatus(400);
    const room =
      rooms.get(req.params.id) ??
      hiphop?.hiphopRooms.get(req.params.id) ??
      social?.socialRooms.get(req.params.id) ??
      retro?.retroRooms.get(req.params.id);
    if (!room) return res.sendStatus(404);
    room.eventTier = tier;
    res.sendStatus(204);
  });
  app.get('/api/operator/decisions', (_req, res) => res.json(decisions()));
  app.get('/api/operator/reports', (_req, res) => res.json(reports()));
  app.post('/api/operator/reports/:id', (req, res) => {
    if (!['mute', 'unmute', 'reviewed'].includes(req.body?.action)) return res.sendStatus(400);
    if (!moderate(req.params.id, res.locals.session.user.id, req.body.action))
      return res.sendStatus(404);
    res.sendStatus(204);
  });
  app.get('/operator/operations.js', serveFile('./public/operations.js'));
  app.get('/lobby', serveFile('./public/lobby.html'));
  app.get('/lobby.js', serveFile('./public/lobby.js'));
  app.get('/api/lobby', (_req, res) =>
    res.json({
      clubs: [
        { id: 'edm', name: 'EDM', open: true, channels: channelList(), capacity },
        ...Object.entries({ hiphop: '힙합', social: '소셜 라운지', retro: '레트로 디스코' }).map(
          ([club, name]) => ({
            name,
            review:
              localTest && res.locals.session.user ? '/review/' + club + '/index.html' : undefined,
            open: false,
            channels: [],
          }),
        ),
      ],
    }),
  );
  app.get('/api/account/profile', (_req, res) =>
    res.json({ ...profile(res.locals.account.id), avatars }),
  );
  app.post('/api/account/profile', (req, res) => {
    const { nickname, avatar } = req.body ?? {};
    if (
      typeof nickname !== 'string' ||
      !nickname.trim() ||
      Array.from(nickname.trim()).length > 32 ||
      /[\u0000-\u001f\u007f]/.test(nickname) ||
      !avatars.includes(avatar)
    )
      return res.sendStatus(400);
    saveProfile(res.locals.account.id, nickname.trim(), avatar);
    res.json(profile(res.locals.account.id));
  });
  app.get(
    '/clubs/edm',
    (req, res, next) => {
      if (!req.signedCookies[guestCookie] && !res.locals.session.user) {
        res.cookie(guestCookie, randomUUID(), {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          signed: true,
          path: '/',
        });
      }
      next();
    },
    serveFile('./public/edm.html'),
  );

  app.post('/clubs/edm/admission', async (req, res) => {
    if (req.get('origin') !== origin.origin) return res.sendStatus(403);
    const session = res.locals.session;
    const guest = req.signedCookies[guestCookie];
    if (!session.user && !guest) return res.status(401).json({ error: 'open_club_first' });
    const identity = session.user?.id ?? 'guest:' + guest;
    if (!session.user && session.reason !== 'login_required')
      return res.status(401).json({ error: session.reason });
    const target = req.body?.channelId;
    if (target !== undefined && (typeof target !== 'string' || target.length > 80))
      return res.sendStatus(400);
    try {
      res.json(
        await reserve(identity, target, session.expires ? Date.parse(session.expires) : null),
      );
    } catch {
      res.status(409).json({ error: 'channel_unavailable' });
    }
  });
  app.get('/clubs/edm/client.js', serveFile('./public/channel-client.js'));
  app.get('/clubs/edm/free-dance.js', serveFile('./public/free-dance.js'));
  app.get('/clubs/edm/avatar.js', serveFile('./public/avatar.js'));
  app.get('/clubs/edm/sdk.js', serveFile('./node_modules/colyseus.js/dist/colyseus.js'));
  app.get('/clubs/edm/music.js', serveFile('./public/music.js'));
  app.get('/clubs/edm/edm-layout.js', serveFile('./edm-layout.js'));
  app.get('/clubs/edm/scene.js', serveFile('./public/live-scene.js'));
  app.get('/stage/festival/index.html', serveFile('../stage/festival/index.html'));
  app.get('/stage/festival/edm-festival.glb', serveFile('../stage/festival/edm-festival.glb'));
  app.get(
    '/dance/node_modules/babylonjs/babylon.js',
    serveFile('../dance/node_modules/babylonjs/babylon.js'),
  );
  app.get(
    '/dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js',
    serveFile('../dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js'),
  );

  // Only Express can request seats. Do not expose the SDK's general HTTP
  // matchmaking controller (which would accept client-provided room options).
  const server = createServer(app);
  const transport = new WebSocketTransport({
    server,
    verifyClient: (info) => info.origin === origin.origin && info.req.headers.host === origin.host,
  });
  EdmRoom.verifyIdentity = async (headers, identity) => {
    const request = { headers };
    const session = await readSession(request, secret);
    if (session.user) return session.user.id === identity;
    if (session.reason !== 'login_required') return false;
    cookieParser(secret)(request, {}, () => {});
    const guest = request.signedCookies[guestCookie];
    return Boolean(guest && identity === 'guest:' + guest);
  };
  await matchMaker.setup();
  matchMaker.defineRoomType('edm', EdmRoom);
  if (localTest) {
    for (const [club, ClubRoom, files] of [
      ['hiphop', hiphop.HipHopRoom, ['interior.js']],
      ['social', social.SocialRoom, ['tables.js', 'interior.js']],
      ['retro', retro.RetroRoom, []],
    ]) {
      ClubRoom.verifyIdentity = EdmRoom.verifyIdentity;
      matchMaker.defineRoomType(club + '-review', ClubRoom);
      app.use('/review/' + club, (_req, res, next) =>
        res.locals.session.user ? next() : res.sendStatus(401),
      );
      for (const file of ['index.html', club + '-empty.glb', 'activities.js', ...files])
        app.get('/review/' + club + '/' + file, serveFile('../stage/' + club + '/' + file));
      app.post('/review/' + club + '/admission', async (_req, res) => {
        const session = res.locals.session;
        try {
          const seat = await matchMaker.joinOrCreate(club + '-review', {
            identity: session.user.id,
            expires: Date.parse(session.expires),
          });
          const { name, roomId, processId } = seat.room;
          res.json({ sessionId: seat.sessionId, room: { name, roomId, processId } });
        } catch {
          res.sendStatus(409);
        }
      });
    }
  }
  await matchMaker.accept();
  transport.listen(port, '127.0.0.1');
}
