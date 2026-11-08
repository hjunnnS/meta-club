# EDM v3 데스크톱 오디오 출력 재검증

통합 시험의 12초 PCM 음원과 군무, 60개 독립 접속, 서버 AI 5개를 재사용한다. 데스크톱 관측 접속을 60개에 포함한다. 군무 장면은 중앙과 데크를 1분마다 교대한다. 서버 기준 시각, 120ms 초과 편차의 위치 보정, 중간의 강제 재동기화는 이전 시험과 같다.

별도 Chrome 페이지에서 시험 탭만 선택해 믹싱된 재생 출력을 48kHz PCM으로 기록한다. 탭의 제목으로 소스를 제한하며 자동 게인, 에코 제거, 잡음 억제를 끈다. 시스템 전체 소리와 마이크는 수집하지 않는다. 브라우저의 위치 대입, 반복, seeking, seeked, waiting 및 playing 시각을 같은 실행에서 남긴다. 시작과 끝에서 각각 450ms 정지·재개를 주어 녹음 시계의 지연을 맞춘다.

5ms 구간의 모든 샘플이 최대 진폭 0.000008 미만이고 10ms 이상 연속할 때 출력 무음으로 센다. 반복·보정과의 연관 범위는 ±250ms다. 다른 종류 이벤트가 500ms 이내면 단독 원인 판정에서 제외한다. 같은 프레임의 연속 위치 대입은 한 보정으로 묶는다. 캡처 자체의 프레임 불연속 250ms 근방에 걸친 무음은 제외한다. 이 판독은 들리는 정도에 대한 청취 평가나 위상 점프·클릭 검사가 아니다.

## 재현

Node, Chrome과 Docker가 필요하다. 저장소 최상위에서 앞선 통합 시험과 동일한 패키지를 설치하고 실행한다. 마지막 인수 1800은 5분 예열 뒤의 본 측정 초 수다. 출력 폴더는 실행마다 새 경로를 지정한다.

```sh
npm ci --ignore-scripts --prefix dance
npm ci --ignore-scripts --prefix validation
docker compose -f validation/soak/compose.yaml up -d
node validation/audio/probe.mjs /tmp/edm-audio-review 1800 --tab
node validation/audio/analyze.mjs /tmp/edm-audio-review
node validation/audio/clips.mjs /tmp/edm-audio-review /tmp/edm-audio-review/clips
docker compose -f validation/soak/compose.yaml down
```

macOS에서 특정 프로세스 출력 탭을 시험할 때는 시스템 오디오 캡처 권한이 필요하다. 아래처럼 로컬 측정기를 빌드하고 위 명령에서 `--tab`을 생략한다. 기기 권한 허용 뒤 macOS의 시험 Chrome 프로세스 출력이 정상 수집됐다. 이 측정은 스피커 디지털 출력 경로를 관측한다. 공기를 통한 스피커·공간 음향은 측정 범위 밖이다.

```sh
clang -fobjc-arc -fblocks -framework Foundation -framework CoreAudio validation/audio/tap.m -Wl,-sectcreate,__TEXT,__info_plist,validation/audio/usage.plist -o /tmp/edm-audio-tap
```

## 2026-11-08 결과

**12초 음원을 반복할 때 macOS 출력이 매번 잠시 끊겼다.** 탭 공유를 끄고 macOS에서 시험 Chrome의 출력을 직접 측정한 30분 동안 반복 150회 중 150회에서 무음이 검출됐다. 반복마다 가장 긴 무음은 55~95ms, 중앙값은 70ms였다. 위치 보정과 500ms 이상 떨어진 반복도 35회 모두 무음이었다. 원본 WAV의 5ms 구간 2,400개 중 임계값 아래인 구간은 0개다. 본 측정의 캡처 시계 불연속도 0건이었다.

- **30분 실제 출력** — 관측 접속 포함 60세션, AI 5명, 정원 불일치 0회, 비의도적 연결 종료 0회. 양 시점에서 60+5가 보였다. macOS 출력의 450ms 정지·재개 교정 신호는 처음과 끝 모두 440ms 무음으로 관측됐다. 이 30분 동안 반복과 250ms 이내로 겹치지 않은 보정 인근에서도 15ms 무음 한 건이 있었다. 시간상 연관만으로 원인을 확정할 수 없다. [파형 분석](results/native/analysis.json) · [서버·이벤트 기록](results/native/trial.json) · [반복 구간 3초](results/native/loop.wav) · [일반 구간 3초](results/native/regular.wav)
- **독립 경로 대조** — 별도 30분 실행의 Chrome 탭 출력에서도 반복 149/149회에서 무음을 확인했다. 이 실행과 시간이 겹치는 26분 34초 동안 macOS에서 동시에 받은 출력도 133/133회였다. [탭 출력 결과](results/tab/analysis.json) · [동시간대 macOS 출력](results/overlap/analysis.json)
- **위치 보정 분리 시험** — 같은 60+5에서 4분 동안 반복과 떨어진 위치에 ±150ms 보정 20회와 무조작 대조 20회를 배치했다. 각 시점 ±250ms 안의 10ms 이상 무음은 각각 0/20회였다. 추가 위치 대입이 전후 500ms 안에 없었던 +150ms 보정 10회에서 보정 시각을 가로지른 출력 박자 간격은 390~405ms였다. 무조작 대조 20회에서는 모두 500ms였다. −150ms 사례는 모두 서버 기준 자동 보정과 가까워 단독 효과를 분리하지 않았다. [보정·대조 판독](results/seek-controls/analysis.json)

본 시험은 EDM v3, Apple M5 Pro, Chrome 156, Babylon.js 9.35.0 및 Colyseus 조합에서 수행했다. 시험 음원과 재생 코드는 기존 상태로 측정했다. 순환 재생의 무음과 보정 시 박자 간격 변화가 수정 후 재시험할 대상이다.

## 수정본

EDM 통합 시험은 디코딩한 음원을 Web Audio 버퍼에서 연속 반복하고, 재생 중 서버 시계와의 차이를 속도 ±2%로 보정한다. 위 30분 기록은 수정 전 결과다. 수정 후 기존 90초 측정에서는 60세션과 AI 5명을 유지했고 반복 7회와 ±150ms 보정 7회에서 10ms 이상 무음이 검출되지 않았다. 보정 시 박자 간격은 490~510ms였다. 캡처 시계 불연속 1회는 해당 이벤트와 겹치지 않았다. [수정 후 측정 기록](results/fixed-90s/analysis.json)
