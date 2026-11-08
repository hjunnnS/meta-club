export const localTest = process.env.CLUB_LOCAL_TEST === '1';

if (localTest) {
  const origin = new URL(process.env.AUTH_URL);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (process.env.NODE_ENV === 'production' || origin.protocol !== 'https:' || !loopback) {
    throw new Error('CLUB_LOCAL_TEST requires a non-production HTTPS loopback origin');
  }
}
