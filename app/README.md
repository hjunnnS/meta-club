# G1 웹 로그인

Node.js 24 이상에서 실행한다. 같은 공개 HTTPS 주소로 PC·모바일 웹을 제공하고, TLS 프록시가 원래 Host와 X-Forwarded-Proto: https를 로컬 서버로 전달하도록 설정한다.

Google에는 웹 OAuth 클라이언트와 `/auth/callback/google`의 전체 HTTPS 주소를 등록한다. Apple에는 Sign in with Apple이 연결된 Services ID, 도메인, `/auth/callback/apple`의 전체 HTTPS Return URL을 등록한다. AUTH_APPLE_SECRET에는 해당 Services ID용으로 서명된 유효한 client secret JWT를 넣고 만료 전에 갱신한다. AUTH_SECRET에는 충분히 긴 무작위 값을 설정한다.

이 디렉터리에서 `npm ci` 후 .env.example을 참고해 .env를 작성하고 `node --env-file=.env server.js`로 실행한다. 이미 서버 환경 변수를 주입했다면 `npm start`를 사용한다. 계정은 인증 제공자와 제공자의 고유 사용자 ID 조합으로 식별한다.
