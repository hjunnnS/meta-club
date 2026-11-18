# EDM 3인 공동 시험 배포 준비

G4 / Epic #3 / Implementation #174. PR #173의 최신 UI를 선행으로 한다.
화면과 기존 Colyseus를 같은 Node 서버/주소에서 제공한다. 기존 개인 Sites는 변경하지 않는다.

## 현재 단계

유료 서비스/스토리지/계정 구독을 만들지 않았다. 비용 승인과 Railway 계정 연결 전에는 배포하지 않는다.
배포용 파일은 저장소 루트의 `Dockerfile.shared-trial`, `railway.json`이다.
운영 로그인과 결제는 연결하지 않는다. 개별 코드가 있는 시험 회원 3명만 채널에 입장할 수 있다.

## 배포할 구성

- Node 24 서버 1개, replica 1개, WebSocket 지원 HTTPS 주소, `/healthz` 기동 확인.
- 공동 시험에 `CLUB_SHARED_TRIAL=1`; 기존 `CLUB_LOCAL_TEST=0` 유지.
- 시험 회원 번호 1·2·3 + 각각 다른 입장 코드. 별도 브라우저에서 각 번호를 하나씩 사용한다.
- 기존 중복 접속 방지를 유지하고 세 캐릭터의 첫 위치만 1.6m 간격으로 구분한다.
- 기존 실제 인원 정원/AI 감축/구역 개방/음악·연출 시계·맵·동작은 유지한다.
- 영구 볼륨 0.5GB를 `/data`에 연결, `CLUB_DB=/data/club.sqlite`. 서버 재시작 시 시험 프로필과 인증 키를 보존한다. 실시간 좌표/공연 상태는 기존 메모리 상태라 재기동 시 채널이 새로 생성될 수 있다.
- 저장소 루트에서 빌드한다. `app`만 root directory로 지정하지 않는다.
- 운영자 권한 및 과거 모의 결제 API는 공동 시험에서 제공하지 않는다.

## 배포 직전 설정

비용 승인 후 비공개 로컬 터미널에서 `node app/shared-trial-codes.mjs`를 실행한다.
출력에는 비밀이 포함되므로 Git/Issue/PR/공개 로그에 넣지 않는다.
서버 환경에 `AUTH_SECRET`과 `CLUB_SHARED_TRIAL_CODE_HASHES`만 저장하고, 원래 코드는 각 시험자에게 별도로 전달한다.

필수 서버 환경:

```text
AUTH_URL=https://발급받은-시험-주소
AUTH_SECRET=생성한-서버-비밀
CLUB_SHARED_TRIAL=1
CLUB_LOCAL_TEST=0
CLUB_SHARED_TRIAL_CODE_HASHES=생성한-3개-해시-JSON
CLUB_SHARED_TRIAL_EXPIRES_AT=시험-종료-UTC-시각
CLUB_DB=/data/club.sqlite
OPERATOR_ACCOUNT_IDS=
RAILWAY_RUN_UID=0
```

`RAILWAY_RUN_UID=0`은 Railway의 root 소유 영구 볼륨에 SQLite를 기록하기 위한 공식 안내 설정이다.
종료 시각은 실제 배포일 기준 합의한 2~3주 기간 안에서 지정한다. 종료 시 입장/세션을 거절하고 기존 접속도 해당 시각까지로 제한한다.
플랫폼의 자동 수면은 사용하지 않고, 개인 Mac이나 터널에 의존하지 않는다.

## 비용 제안 — 2026-11-15 공식 안내 확인

Railway Hobby는 월 최소 US$5이며 이 금액에 사용액이 포함된다. 사용액이 US$8이면 합계 US$8이다.
RAM US$10/GB·월, CPU US$20/vCPU·월, 송신 US$0.05/GB, 볼륨 US$0.15/GB·월이다.
예: 평균 RAM 0.25GB+평균 CPU 0.025vCPU+0.5GB 볼륨+송신 2GB를 월 환산하면 약 US$3.175로 최소 US$5 적용이다.
이는 측정값이나 견적 보장이 아닌 계산 예시다. 실제 사용량, 세금/결제 조건, 기존 계정 요금은 별도 확인한다.
3인 단기 시험 예산은 월 US$5~10 수준을 제안하되 초과 사용량은 비용이 늘 수 있다.
시험 전용 워크스페이스에 월 Compute hard limit US$10 설정을 제안한다. 도달하면 서비스가 중단된다.
이 제한은 워크스페이스 전체에 적용되므로 다른 프로젝트와 공유된 환경의 한도는 임의로 변경하지 않는다.
Hobby 구독 최소액과 실사용액의 적용은 공식 청구 내역을 따른다. 종료 후 서버/볼륨/구독의 과금 종료도 별도로 확인해야 한다.

출처: https://docs.railway.com/pricing · https://docs.railway.com/pricing/cost-control · https://docs.railway.com/volumes

## 한정 검증

`node --test validation/shared-trial-config.test.mjs`
`node validation/shared-trial-live.mjs`

새 코드 검증과 로컬 실제 Colyseus의 3개 독립 클라이언트만 확인한다. 실제 세 사람의 외부 참가·브라우저 화면·모바일·장시간·부하/60명 성능 검증을 대신하지 않는다.
음원 이용 증빙·실제 Google/Apple·가격/결제·모바일의 기존 보류는 유지한다.

### 2026-11-15 준비 결과

- 설정 검사 4건 통과: 3개 신원 분리/오류 코드·만료 거절, 잘못된 설정 거절, 원래 localhost 보호 유지, 슬롯별 실패 횟수 제한.
- 로컬 실제 Colyseus 3개 독립 클라이언트 통과: 같은 room, 서로 다른 시작점, 실제 캐릭터3명/춤·인사 공유, 귓속말 제3자 격리, 실제 인원3, 중복 입장 거절, 좌석 점유 공유/중복 거절/기립, 운영자403·결제404.
- 최종 Node24 배포 이미지 빌드 및 컨테이너 내부 `/healthz` 200 확인 후 종료. 유료 서버·외부 배포 없음.
- 독립 실행에서 브라우저용 절대 모듈 경로를 해석하지 못하던 문제는 서버 시작 모듈의 정확한 경로 별칭으로 해결했다. 기존 시각 효과 소스는 변경하지 않았다.
- 이미지 제작 시 확인한 `nanoid` 경고는 Colyseus 0.16을 유지한 채 하위 패키지3.3.18 및 default-import 호환 어댑터로 해결했다. 새 이미지 설치 검사에서 취약점0 보고, 컨테이너 기동 통과. 브라우저 엔진 버전은 유지했다.
- 실제 외부 참가·최종 주소·Railway 비용 승인/계정 연결은 대기다. 기존 개인 Sites v90은 그대로다.
- Epic #3의 실제 sub-issue 연결은 현재 CLI 계정에 AddSubIssue 권한이 없어 적용하지 못했다. Epic/Issue 상호 참조는 기록했으며 실제 연결 완료로 표시하지 않는다.
