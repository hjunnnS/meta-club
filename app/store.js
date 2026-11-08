import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = resolve(process.env.CLUB_DB || 'data/club.sqlite');
mkdirSync(dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS profile(account TEXT PRIMARY KEY, nickname TEXT NOT NULL, avatar TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS report(id TEXT PRIMARY KEY, author TEXT NOT NULL, target TEXT NOT NULL,
    channel TEXT NOT NULL, note TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS decision(id TEXT PRIMARY KEY, report_id TEXT NOT NULL, target TEXT NOT NULL,
    operator TEXT NOT NULL, action TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS decisions_by_target ON decision(target, created);
`);

export const avatars = ['indigo', 'teal', 'rose'];
export function profile(account) {
  return (
    db.prepare('SELECT nickname,avatar FROM profile WHERE account=?').get(account) ?? {
      nickname: account.startsWith('guest:') ? '게스트' : '방문자',
      avatar: avatars[0],
    }
  );
}
export function saveProfile(account, nickname, avatar) {
  db.prepare(
    'INSERT INTO profile VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET nickname=excluded.nickname, avatar=excluded.avatar',
  ).run(account, nickname, avatar);
}
export function reports() {
  return db
    .prepare(
      'SELECT r.*, (SELECT action FROM decision WHERE report_id=r.id ORDER BY rowid DESC LIMIT 1) AS last_action FROM report r ORDER BY created DESC LIMIT 100',
    )
    .all();
}
export function decisions() {
  return db
    .prepare(
      'SELECT report_id,target,operator,action,created FROM decision ORDER BY rowid DESC LIMIT 100',
    )
    .all();
}
// The sequence is the server's receipt order. Payment verification and grants belong to #31/#34.
db.exec(`
  CREATE TABLE IF NOT EXISTS mock_order (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL, intent TEXT NOT NULL, channel TEXT NOT NULL,
    product TEXT NOT NULL, message TEXT NOT NULL, amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    UNIQUE(account, intent)
  );
`);
export function mockOrder(account, intent) {
  return db
    .prepare(
      'SELECT sequence,intent,channel,product,message,amount,status FROM mock_order WHERE account=? AND intent=?',
    )
    .get(account, intent);
}
export function requestMockOrder(account, intent, channel, product, message, amount) {
  db.prepare(
    'INSERT INTO mock_order(account,intent,channel,product,message,amount) VALUES(?,?,?,?,?,?) ON CONFLICT(account,intent) DO NOTHING',
  ).run(account, intent, channel, product, message, amount);
  return mockOrder(account, intent);
}
export function finishMockRequest(account, intent, status) {
  db.prepare(
    "UPDATE mock_order SET status=? WHERE account=? AND intent=? AND status='requested'",
  ).run(status, account, intent);
  return mockOrder(account, intent);
}
