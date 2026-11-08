import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { Room, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

const capacity = 60;
const seatSeconds = 15;
const guestCookie = '__Host-club-guest';
// A reservation and an established connection are different states. Only
// established clients count as visitors; AI entities never consume seats.
const pending = new Map();
const connected = new Map();

class EdmRoom extends Room {
  onCreate() {
    this.maxClients = capacity;
    this.setSeatReservationTime(seatSeconds);
    this.onMessage('occupancy', client => client.send('occupancy', this.population()));
  }

  population() {
    return { channelId: this.roomId, people: this.clients.length, capacity };
  }

  onJoin(client, { identity }) {
    if (connected.has(identity)) throw new Error('Already joined');
    client.userData = identity;
    connected.set(identity, { room: this, client });
    pending.delete(identity);
    this.broadcast('occupancy', this.population());
  }

  onLeave(client) {
    const identity = client.userData;
    if (connected.get(identity)?.client === client) connected.delete(identity);
    this.broadcast('occupancy', this.population());
  }
}

function reserve(identity) {
  const active = connected.get(identity);
  if (active) return { status: 'already_joined', ...active.room.population() };
  if (pending.has(identity)) return pending.get(identity);

  const clear = () => {
    if (pending.get(identity) === request) pending.delete(identity);
  };
  const request = matchMaker.joinOrCreate('edm', { identity }).then(seat => {
    setTimeout(clear, seatSeconds * 1000).unref();
    const { name, roomId, processId } = seat.room;
    return { status: 'reserved', seat: { sessionId: seat.sessionId, room: { name, roomId, processId } } };
  }).catch(error => { clear(); throw error; });
  pending.set(identity, request);
  return request;
}

export async function startChannels(app, { origin, secret, port }) {
  const serveFile = relative => (_req, res) => res.sendFile(fileURLToPath(new URL(relative, import.meta.url)));
  app.use('/clubs/edm', cookieParser(secret));
  app.get('/clubs/edm', (req, res, next) => {
    if (!req.signedCookies[guestCookie] && !res.locals.session.user) {
      res.cookie(guestCookie, randomUUID(), {
        httpOnly: true, secure: true, sameSite: 'lax', signed: true, path: '/',
      });
    }
    next();
  }, serveFile('./public/edm.html'));

  app.post('/clubs/edm/admission', async (req, res) => {
    if (req.get('origin') !== origin.origin) return res.sendStatus(403);
    const session = res.locals.session;
    const guest = req.signedCookies[guestCookie];
    if (!session.user && !guest) return res.status(401).json({ error: 'open_club_first' });
    const identity = session.user?.id ?? 'guest:' + guest;
    res.json(await reserve(identity));
  });
  app.get('/clubs/edm/client.js', serveFile('./public/channel-client.js'));
  app.get('/clubs/edm/sdk.js', serveFile('./node_modules/colyseus.js/dist/colyseus.js'));
  app.get('/stage/festival/index.html', serveFile('../stage/festival/index.html'));
  app.get('/stage/festival/edm-festival.glb', serveFile('../stage/festival/edm-festival.glb'));
  app.get('/dance/node_modules/babylonjs/babylon.js', serveFile('../dance/node_modules/babylonjs/babylon.js'));
  app.get('/dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js', serveFile('../dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js'));

  // Only Express can request seats. Do not expose the SDK's general HTTP
  // matchmaking controller (which would accept client-provided room options).
  const server = createServer(app);
  const transport = new WebSocketTransport({
    server, verifyClient: info => info.origin === origin.origin && info.req.headers.host === origin.host,
  });
  await matchMaker.setup();
  matchMaker.defineRoomType('edm', EdmRoom);
  await matchMaker.accept();
  transport.listen(port, '127.0.0.1');
}
