import Google from '@auth/express/providers/google';
import { decodeSession } from './session.js';
import Apple from '@auth/express/providers/apple';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error('Missing server configuration: ' + name);
  return value;
}

export const origin = new URL(required('AUTH_URL'));
if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/') {
  throw new Error('AUTH_URL must be the public HTTPS origin');
}
const secret = required('AUTH_SECRET');
if (Buffer.byteLength(secret) < 32) throw new Error('AUTH_SECRET must be at least 32 bytes');

export const auth = {
  basePath: '/auth',
  secret,
  trustHost: true,
  useSecureCookies: true,
  jwt: { decode: decodeSession },
  providers: [
    Google({
      clientId: required('AUTH_GOOGLE_ID'),
      clientSecret: required('AUTH_GOOGLE_SECRET'),
      checks: ['pkce', 'state', 'nonce'],
    }),
    Apple({
      clientId: required('AUTH_APPLE_ID'),
      clientSecret: required('AUTH_APPLE_SECRET'),
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account) token.sub = account.provider + ':' + account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      return { expires: session.expires, user: { id: token.sub } };
    },
  },
};
