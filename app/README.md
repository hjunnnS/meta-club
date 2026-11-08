# G1 웹 로그인

Node.js 24 이상에서 실행한다. 같은 공개 HTTPS 주소로 PC·모바일 웹을 제공하고, TLS 프록시가 원래 Host와 X-Forwarded-Proto: https를 로컬 서버로 전달하도록 설정한다.

Google에는 웹 OAuth 클라이언트와 `/auth/callback/google`의 전체 HTTPS 주소를 등록한다. Apple에는 Sign in with Apple이 연결된 Services ID, 도메인, `/auth/callback/apple`의 전체 HTTPS Return URL을 등록한다. AUTH_APPLE_SECRET에는 해당 Services ID용으로 서명된 유효한 client secret JWT를 넣고 만료 전에 갱신한다. AUTH_SECRET에는 충분히 긴 무작위 값을 설정한다.

이 디렉터리에서 `npm ci` 후 .env.example을 참고해 .env를 작성하고 `node --env-file=.env server.js`로 실행한다. 이미 서버 환경 변수를 주입했다면 `npm start`를 사용한다. 계정은 인증 제공자와 제공자의 고유 사용자 ID 조합으로 식별한다.

## 게스트 접근 권한

D-05에 따라 로그인 전에도 로비 열람과 클럽 입장이 가능하다. `GET /api/access`는 현재 사용자의 유형과 이 두 접근 권한을 반환한다. `/api/account`는 인증된 계정에만 제공한다. 클럽 입장 권한은 좌석이나 정원을 예약하지 않는다.

클럽 내부에서 게스트가 사용할 세부 활동은 추후 결정한다. 후속 기능은 입장 권한을 개별 활동 권한으로 재사용하지 않고 해당 정책을 서버에서 별도로 적용한다.

## 세션 유지와 만료 (#15)

새로고침해도 서버는 기존 Auth.js 쿠키를 복호화해 같은 계정을 복원한다. `GET /api/session`은 인증 시 사용자 ID와 현재 쿠키의 만료 시각을, 게스트면 사유를 반환한다. 계정 API의 거절 응답은 HTTP 401이며 사유는 쿠키 없음(`login_required`), 만료된 쿠키 재사용(`session_expired`), 복호화·검증 실패(`session_invalid`)로 구분한다. 브라우저가 만료 쿠키를 이미 제거했다면 서버에는 쿠키 없음으로 표시된다.

세션 수명과 정상 세션의 갱신은 기존 Auth.js 설정을 따른다. 상태 조회 자체는 만료 시각을 연장하지 않는다. 세션 만료 후에도 게스트의 로비 열람·클럽 입장 권한은 적용된다.

## 운영자 접근 (#24)

운영자는 일반 사용자와 같은 Google·Apple 로그인으로 인증한다. 서버의 `OPERATOR_ACCOUNT_IDS`에 승인한 계정의 `/api/account` 응답 ID를 쉼표로 구분해 등록한다. 예를 들어 Google 계정의 형식은 `google:<provider subject>`다. 빈 설정은 모든 계정의 운영 접근을 거절한다. 목록을 바꾼 뒤 서버를 재시작하면 기존 로그인에도 변경 사항이 적용된다.

운영자 계정에는 홈에 운영자 공간 링크가 표시된다. 서버는 `/operator`와 `/api/operator` 아래의 요청마다 세션과 목록을 확인한다. 미인증·만료는 401, 인증된 일반 계정은 403이다. 거절 시 서버 표준 오류 로그에 `operator_access_denied` JSON 한 줄을 남긴다. 로그에는 시각·접근 영역·메서드·확인된 계정 ID·상태 코드·거절 사유를 기록한다.
