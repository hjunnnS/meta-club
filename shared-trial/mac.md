# Mac 실행 · 무료 외부 주소 · 3명 공동 EDM

## 현재 입장 방식 (2026-11-15 변경)

사용자 요청으로 공개 체험의 번호·코드 입력을 제거했다. 아래 초기 설치의 코드 안내는 이전 방식이다.
Docker 이미지의 `CLUB_SHARED_TRIAL_AUTO_ENTRY=1`은 공동 시험 모드에서만 URL 자동 입장을 켠다.
브라우저마다 UUID가 담긴 서명된 Secure/HttpOnly/SameSite=Lax 쿠키를 발급하고 재접속 시 유효한 세션을 유지한다.
일반 서비스 로그인·운영자 권한·결제 정책은 변경하지 않는다. URL을 아는 사람은 시험 기간 중 입장할 수 있다.

기존 Sites `/clubs/edm/` 주소는 Mac EDM으로 자동 이동한다. 통로 호스트 변경 시 Sites 입구도 갱신한다.
`validation/mac-shared-trial-auto.mjs`로 입력 없는 독립 접속3개, 세션 재사용, 같은 EDM의 캐릭터·춤·인사 공유,
귓속말 격리, 실제 인원3 및 운영자 권한 거부를 한 번 확인했다. 확인용 접속은 퇴장했다.
기존 음악·맵·클럽 연출·캐릭터 애니메이션 변경 없음.

G4 / Epic #3 / Implementation #174, PR #175. 2026-11-15 사용자가 Mac을 계속 켜 두는 방식으로 변경 승인했다.
기존 유료 배포 승인 질문은 이 시험 경로의 선행 조건이 아니다. Railway/Render/유료 서버는 생성하지 않았다.

## 실행 구성

기존 Node24/Colyseus 서버 이미지를 Mac Docker에서 실행한다. 서버 포트는 Mac의 127.0.0.1:18821에만 바인딩한다.
Cloudflare 공식 cloudflared 2026.11.0 Quick Tunnel이 무료 임시 HTTPS 주소를 제공한다. 원래 localhost 모드의 제한을 해제하지 않고 #174의 개별 코드 공동 시험 모드를 사용한다.

Mac의 사용자 세션에서 launchctl `com.hjunnns.meta-club.edm174` 작업이 서버와 통로를 관리한다. `caffeinate -i`는 이 작업이 실행 중일 때만 잠자기를 방지한다. 시스템 전역 잠자기/보안 설정은 변경하지 않는다. 화면을 끄는 것은 가능하지만 Mac 전원·인터넷·Docker는 유지해야 한다. 재부팅/로그아웃 후에는 다시 시작이 필요할 수 있다.

실행기는 Documents 밖의 허용된 영구 작업 폴더에 복사해 백그라운드 실행한다. 소스의 `.local/mac-trial-runtime.json`이 그 폴더를 가리킨다. 실제 비밀/코드/DB/로그/안내서는 실행 폴더의 `.local/shared-edm` 안에 있으며 Git/공개 Sites에 올리지 않는다.

시험 인증 키와 3개 코드/DB는 재시작해도 보존한다. 임시 외부 주소는 통로 재생성 시 바뀔 수 있고, 새 주소는 `status.json`과 `입장안내.html`에 갱신된다. 서버 자체만 재시작할 때는 통로 주소를 유지한다. 최초 실행 기준 14일 만료이며 코드/서버 비밀을 자동으로 공개하거나 자동 연장하지 않는다.

## 시작·상태·종료

소스의 `app` 폴더에서 각각 다음을 실행한다.

```text
npm run mac:trial:start
npm run mac:trial:status
npm run mac:trial:stop
```

상태 출력에는 주소·만료/실행 정보만 있고 입장 코드는 없다. 비공개 안내 HTML에는 세 사람의 코드가 있으므로 각 참가자에게 본인이 쓸 번호와 코드 한 개만 전달한다.
같은 번호를 두 사람이 동시에 쓰면 기존 중복 접속 방지가 작동한다. 링크만으로 시험 회원 권한을 얻지는 못한다.

## 처음 설치/업데이트

저장소의 현재 `Dockerfile.shared-trial`로 Mac 이미지 `meta-club-shared-trial:review`를 준비한다. Cloudflare 공식 arm64 도구를 `.local/tools/cloudflared`에 준비한다. 설치할 별도 실행 폴더 경로를 지정한다.

```text
node app/mac-shared-trial-install.mjs <허용된-별도-실행-폴더>
```

기존 실행 파일을 갱신할 때에는 먼저 stop, 이미지/실행기 갱신, start 순서로 진행한다. 새 코드 업데이트 때 이미 실행 중인 서버를 임의로 재시작하지 않는다.

## 2026-11-15 한정 확인

- 공용 HTTPS에서 health/session/CSRF/클럽 HTML 응답200.
- 실제 Auth.js CSRF·개별 코드로 시험 회원1·2·3 로그인 및 외부 WebSocket3개 연결.
- 같은 채널의 실제 캐릭터3명·춤·대상 인사 이벤트 공유, 받는 사람에게만 귓속말 전달, 실제 인원3 집계.
- 확인용 접속3개는 퇴장시켰으며 서버/통로는 사용자를 위해 계속 실행한다. 음악 재생·전체 연출·모바일/부하 재검증은 하지 않았다. 실제 세 사람의 참가 평가와 구분한다.
- 기존 음악/맵/공연/조명/캐릭터 동작 파일은 변경하지 않았다. 개인 Sites v90도 그대로다.
- 공식 참고: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ . 임시 시험용이며 고정 주소나 가용성 보장은 없다.

## 2026-11-18: current URL-only shared entry

Share the existing Sites `/clubs/edm/` URL. Its landing page reads the current public endpoint from the dedicated `trial-endpoint` branch, then enters the Mac server. The supervisor republishes after server readiness and on tunnel replacement, with retry every 60 seconds when publishing failed. The dedicated generated Git checkout is `.local/shared-edm/endpoint-source`; it contains only public URL/availability/expiry/update time. It uses existing Mac Git credentials and never receives trial secrets or DB contents. No Sites source credential is stored by the supervisor.

A deliberate shutdown publishes unavailable status when GitHub is reachable; otherwise the last published origin may remain until the next successful update. This is a free development path, not a fixed-hostname or availability guarantee. The Mac, Docker, internet and existing Git push authentication must remain available. No access codes are required in current auto-entry mode; older code-based instructions above are retained as historical setup.

Appearance now persists to the existing SQLite volume by trial identity. The same session identity restores it on re-entry/server restart. An anonymous visitor on a different browser or a new tunnel hostname receives a different identity; cross-device linking requires future real login. Do not promise anonymous cross-device persistence.
