# EDM Sites 개인 체험판

공개 URL: https://meta-club-edm-personal-trial.fond-bell-1966.chatgpt.site

기존 Colyseus/로그인/SQLite 코드는 유지한다. `export.py <Site 체크아웃>`이 승인된 맵·자산·화면 코드를
복사하고 개인 브라우저 상태 어댑터만 연결한다. 현재 Site 체크아웃은 상위 workspace의
`sites/edm-personal-trial`이며 그 `.openai/hosting.json`의 project_id를 재사용해야 한다.
새 Site를 중복 생성하지 않는다. 배포 갱신에는 Sites 소스 동기화·버전 저장·배포 절차를 사용한다.

방문자별 위치·좌석·AI 상태는 브라우저 안에서 독립 동작한다. 공유 채널/서버 정원 시험판은 아니다.
전체 구역 개방은 개인 화면 검토용이며 운영 정책을 바꾸지 않는다. 기본 AI 손님은 20명이다.
원본 서버의 환경 변수·비밀 키·SQLite DB·프로필 데이터는 내보내지 않는다.

음악은 브라우저 정책에 따라 음악 시작 버튼을 눌러 켠다. 기존 효과 시험 버튼과 7키 리듬게임을 포함한다.
사용자 요청으로 추가 테스트/플레이 검수는 하지 않았으며, 배포 성공과 사용자 화면 검수 통과를 구분한다.

관리: G4 Milestone #5 / Epic #5 / Implementation #154 / PR #137.
