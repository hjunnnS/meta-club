import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { capacity, seatSeconds, pending, connected, recent, rooms, EdmRoom } from './club-room.js';
import { avatars, profile, saveProfile, reports, decisions } from './store.js';
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
  const clubRooms = {
    edm: rooms,
    hiphop: hiphop?.hiphopRooms,
    social: social?.socialRooms,
    retro: retro?.retroRooms,
  };
  const channelList = () => [...rooms.values()].map((r) => r.population());
  app.get('/api/operator/channels', (_req, res) => {
    const channels = [];
    for (const [clubId, registry] of Object.entries(clubRooms)) {
      if (!registry) continue;
      for (const room of registry.values()) channels.push({ clubId, ...room.population() });
    }
    res.json(channels);
  });
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
  app.get('/operator/operations.js', serveFile('./public/operations.js'));
  app.get('/lobby', serveFile('./public/lobby.html'));
  app.get('/lobby.js', serveFile('./public/lobby.js'));
  app.get('/api/lobby', (_req, res) => {
    const testMember = localTest && res.locals.session.user;
    const clubs = [
      { id: 'edm', name: 'EDM', open: true, channels: channelList(), capacity },
      ...Object.entries({ hiphop: '힙합', social: '소셜 라운지', retro: '레트로 디스코' }).map(
        ([id, name]) => ({
          id, name, open: false, channels: [],
          review: testMember ? '/clubs/' + id + '/' : undefined,
        }),
      ),
    ];
    if (testMember) {
      for (const club of clubs) {
        club.people = 0;
        for (const room of clubRooms[club.id].values()) club.people += room.members.size;
      }
    }
    res.json({ clubs });
  });
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
  app.get('/clubs/edm/podium-activity.js', serveFile('./podium-activity.js'));
  app.get('/clubs/edm/seat-presentation.js', serveFile('./public/seat-presentation.js'));
  app.get('/clubs/edm/social-effects.js', serveFile('./public/social-effects.js'));
  app.get('/clubs/edm/social-trial.js', serveFile('./social-trial.js'));
  app.get('/clubs/edm/wand-ornament.js', serveFile('./public/wand-ornament.js'));
  app.get('/clubs/edm/club-actions-ui.js', serveFile('./public/club-actions-ui.js'));
  app.get('/clubs/edm/club-event-renderer.js', serveFile('./public/club-event-renderer.js'));
  app.get('/clubs/edm/shout-screen.js', serveFile('./public/shout-screen.js'));
  app.get('/clubs/edm/parade-plan.js', serveFile('./parade-plan.js'));
  app.get('/clubs/edm/parade-woman.js', serveFile('./public/parade-woman.js'));
  app.get('/clubs/edm/private-whisper-feedback.js', serveFile('./public/private-whisper-feedback.js'));
  app.get('/clubs/edm/club-activities.js', serveFile('./club-activities.js'));
  app.get('/clubs/edm/wand-customization.js', serveFile('./public/wand-customization.js'));
  app.get('/clubs/edm/wand-trail.js', serveFile('./public/wand-trail.js'));
  app.get('/clubs/edm/pole-dance.js', serveFile('./public/pole-dance.js'));
  app.get('/clubs/edm/free-dance.js', serveFile('./public/free-dance.js'));
  app.get('/clubs/edm/ceiling-lights.js', serveFile('./public/ceiling-lights.js'));
  app.get('/clubs/edm/rhythm-floor.js', serveFile('./public/rhythm-floor.js'));
  app.get('/clubs/edm/avatar.js', serveFile('./public/avatar.js'));
  app.get('/clubs/edm/sdk.js', serveFile('./node_modules/colyseus.js/dist/colyseus.js'));
  app.get('/clubs/edm/music.js', serveFile('./public/music.js'));
  app.get('/clubs/edm/edm-layout.js', serveFile('./edm-layout.js'));
  app.get('/clubs/edm/rhythm-game.js', serveFile('./public/rhythm-game.js'));
  app.get('/clubs/edm/neon-horizon-chart.json', serveFile('./public/neon-horizon-chart.json'));
  app.get('/clubs/edm/activity-feedback.js', serveFile('./public/activity-feedback.js'));
  app.get('/clubs/edm/scene-look.js', serveFile('./public/scene-look.js'));
  app.get('/clubs/edm/click-walk.js', serveFile('./public/click-walk.js'));
  app.get('/clubs/edm/scene.js', serveFile('./public/live-scene.js'));
  app.get('/clubs/edm/ambience.js', serveFile('./public/ambience.js'));
  app.get('/stage/festival/celebration.js', serveFile('../stage/festival/celebration.js'));
  app.get('/stage/festival/holograms.js', serveFile('../stage/festival/holograms.js'));
  app.get('/stage/festival/events.js', serveFile('../stage/festival/events.js'));
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
    for (const id of ['edm', 'hiphop', 'social', 'retro']) {
      app.get('/lobby-maps/' + id + '.webp', (_req, res, next) =>
        res.locals.session.user ? next() : res.sendStatus(401),
        serveFile('./public/lobby-maps/' + id + '.webp'),
      );
    }
    for (const [club, ClubRoom, files] of [
      ['hiphop', hiphop.HipHopRoom, ['interior.js']],
      ['social', social.SocialRoom, ['tables.js', 'interior.js']],
      ['retro', retro.RetroRoom, ['interior.js']],
    ]) {
      ClubRoom.verifyIdentity = EdmRoom.verifyIdentity;
      const path = '/clubs/' + club;
      const paths = ['/review/' + club, path];
      matchMaker.defineRoomType(club, ClubRoom);
      app.use(paths, (_req, res, next) =>
        res.locals.session.user ? next() : res.sendStatus(401),
      );
      // Relative map and activity URLs resolve from the club directory.
      app.get(new RegExp('^' + path + '$'), (_req, res) => res.redirect(path + '/'));
      app.get(path + '/', serveFile('../stage/' + club + '/index.html'));
      for (const file of ['index.html', club + '-empty.glb', 'activities.js', ...files])
        app.get(paths.map(path => path + '/' + file), serveFile('../stage/' + club + '/' + file));
      app.get(paths.map(path => path + '/member-entry.js'), serveFile('./public/member-entry.js'));
      app.get(paths.map(path => path + '/activity-guide.css'), serveFile('./public/activity-guide.css'));
      app.post(paths.map(path => path + '/admission'), async (_req, res) => {
        const session = res.locals.session;
        try {
          const identity = session.user.id;
          const expires = Date.parse(session.expires);
          const seat = await ClubRoom.reserve(identity, expires);
          const { name, roomId, processId } = seat.room;
          res.json({ memberId: identity, sessionId: seat.sessionId, room: { name, roomId, processId } });
        } catch (error) {
          res.status(409).json({
            error: error.message === 'already_joined' ? 'already_joined' : 'channel_unavailable',
          });
        }
      });
    }
  }
  await matchMaker.accept();
  transport.listen(port, '127.0.0.1');
}
