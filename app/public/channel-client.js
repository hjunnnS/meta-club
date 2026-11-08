const status = document.querySelector('output');
const retry = document.querySelector('button');
const map = document.querySelector('iframe');
let room;

function disconnected(message) {
  room = undefined;
  map.hidden = true;
  map.removeAttribute('src');
  status.textContent = message;
  retry.hidden = false;
}

async function enter() {
  retry.hidden = true;
  status.textContent = '채널 배정 중…';
  try {
    const response = await fetch('/clubs/edm/admission', { method: 'POST' });
    if (!response.ok) throw new Error('Admission failed');
    const admission = await response.json();
    if (admission.status === 'already_joined') {
      disconnected('다른 화면에서 이미 이 채널에 입장했습니다.');
      return;
    }
    const client = new Colyseus.Client('wss://' + location.host);
    room = await client.consumeSeatReservation(admission.seat);
    room.onMessage('occupancy', ({ channelId, people, capacity }) => {
      status.textContent = '채널 ' + channelId + ' · 접속 ' + people + ' / ' + capacity + '명';
    });
    room.onLeave(() => disconnected('채널 연결이 종료됐습니다.'));
    room.send('occupancy');
    map.src = '/stage/festival/index.html';
    map.hidden = false;
  } catch {
    disconnected('입장하지 못했습니다. 다시 시도해 주세요.');
  }
}
retry.onclick = enter;
window.addEventListener('pagehide', () => room?.leave());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
enter();
