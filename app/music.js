// The operator supplies the territory and rights records. Empty catalogues
// are valid: an unapproved track must never be substituted automatically.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, extname } from 'node:path';
import { localTest } from './local-test.js';

const catalogue = !localTest && process.env.CLUB_MUSIC_CATALOG;
const territory = process.env.CLUB_TERRITORY;
const records = catalogue ? JSON.parse(readFileSync(catalogue, 'utf8')) : [];
const ids = new Set();
for (const r of records) {
  if (!r.id || ids.has(r.id)) throw Error('Missing or duplicate music record ID');
  ids.add(r.id);
}
function permitted(r, now) {
  return (
    r.club === 'edm' &&
    r.status === 'approved' &&
    r.approvedBy &&
    r.evidence &&
    r.webStreaming === true &&
    territory &&
    Array.isArray(r.territories) &&
    r.territories.includes(territory) &&
    Date.parse(r.from) <= now &&
    now < Date.parse(r.until) &&
    Number.isFinite(r.duration) &&
    r.duration > 0 &&
    typeof r.file === 'string' &&
    extname(r.file).toLowerCase() === '.wav' &&
    existsSync(resolve(dirname(catalogue), r.file))
  );
}
const testTracks = [{
  id: 'neon-horizon-treblo',
  title: 'Neon Horizon · Treblo',
  file: fileURLToPath(new URL('./fixtures/club-music/neon-horizon-treblo.mp3', import.meta.url)),
  duration: 208.728,
  bpm: 132,
  // Measured full-band and bass RMS per 16 beats of the supplied file.
  energySections: [[0.7,0.727],[0.693,0.692],[0.874,0.947],[0.893,0.965],[0.932,0.983],[0.928,0.973],[0.973,0.991],[0.985,0.997],[0.399,0.287],[0.445,0.288],[0.949,0.93],[0.973,0.957],[0.995,0.978],[0.998,0.975],[0.917,0.965],[0.919,0.964],[0.961,0.977],[0.981,0.994],[0.94,0.994],[0.946,0.994],[0.987,0.969],[0.996,0.97],[0.997,0.977],[0.996,0.967],[0.933,0.987],[0.904,0.949],[0.791,0.811],[0.727,0.722],[0.195,0.228]],
  firstBeat: .23,
  until: null,
  url: '/media/edm/neon-horizon-treblo',
}];
export function playlist(now = Date.now()) {
  if (localTest) return testTracks.map(({file, ...track}) => track);
  return records
    .filter((r) => permitted(r, now))
    .map(({ id, title, duration, until, bpm, firstBeat }) => ({
      id,
      title,
      duration,
      bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : 120,
      firstBeat: Number.isFinite(firstBeat) ? firstBeat : 0,
      until,
      url: '/media/edm/' + encodeURIComponent(id),
    }));
}
export function installMusic(app) {
  app.get('/api/operator/music', (_req, res) =>
    res.json(
      records.map((r) => ({
        id: r.id,
        club: r.club,
        approvedBy: r.approvedBy,
        evidence: r.evidence,
        expires: r.until,
        playable: Boolean(permitted(r, Date.now())),
      })),
    ),
  );
  app.get('/media/edm/:id', (req, res) => {
    if (localTest) {
      // Keep the G0 comparison fixture reachable for existing validation clients.
      if (req.params.id === 'g0-loop')
        return res.sendFile(fileURLToPath(new URL('./fixtures/g0-loop.wav', import.meta.url)));
      const track = testTracks.find(t => t.id === req.params.id);
      return track ? res.sendFile(track.file) : res.sendStatus(404);
    }
    const record = records.find((r) => r.id === req.params.id && permitted(r, Date.now()));
    if (!record) return res.sendStatus(404);
    res.sendFile(resolve(dirname(catalogue), record.file), { cacheControl: false });
  });
}
