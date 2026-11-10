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
  id: 'club-style-selected',
  title: 'Club Style 02',
  file: fileURLToPath(new URL('./fixtures/club-music/club_style_2_60s.mp3', import.meta.url)),
  duration: 60,
  bpm: 134,
  firstBeat: 0,
  until: null,
  url: '/media/edm/club-style-selected',
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
