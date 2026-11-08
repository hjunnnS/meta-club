function offerLogin(nav, status) {
  status.textContent = '다시 로그인하면 이 클럽으로 돌아옵니다.';
  const login = document.createElement('a');
  login.textContent = '다시 로그인';
  login.href = '/auth/signin?callbackUrl=' + encodeURIComponent(location.pathname);
  login.style.color = 'inherit';
  nav.replaceChildren(login);
}

export function offerReentry(nav, status, message = '클럽 연결이 끊겼습니다.') {
  status.textContent = message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '다시 입장';
  nav.replaceChildren(retry);
  retry.onclick = async () => {
    retry.disabled = true;
    status.textContent = '로그인 상태를 확인하고 있습니다.';
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) throw Error();
      const session = await response.json();
      if (session.status !== 'authenticated') return offerLogin(nav, status);
      // Restart the current scene at its entrance with fresh room listeners and controls.
      location.reload();
    } catch {
      status.textContent = '서버에 연결할 수 없습니다. 연결이 복구되면 다시 입장해 주세요.';
      retry.disabled = false;
    }
  };
}

function showActivityGuide(room, memberId) {
  const guide = document.getElementById('activity-guide');
  if (!guide) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './activity-guide.css';
  document.head.append(css);

  guide.open = true;
  try {
    const key = JSON.stringify(['club-activity-guide', memberId, room.name]);
    guide.open = localStorage.getItem(key) !== 'seen';
    if (guide.open) localStorage.setItem(key, 'seen');
  } catch {
    // The guide also works when the browser disables persistent storage.
  }
  guide.hidden = false;
  const labels = { OPEN: '열림', CLOSED: '닫힘', OPENING: '준비 중', DRAINING: '퇴장 대기' };
  const tiers = guide.querySelectorAll('[data-tier]');
  room.onMessage('snapshot', ({ zones }) => {
    for (const element of tiers) {
      const state = labels[zones[Number(element.dataset.tier) - 1]] ?? '상태 확인 중';
      if (element.textContent !== state) element.textContent = state;
    }
  });
  room.onLeave(() => { guide.hidden = true; });
}

export async function enterClub(nav, status) {
  try {
    const sdk = document.createElement('script');
    sdk.src = '/clubs/edm/sdk.js';
    await new Promise((resolve, reject) => {
      sdk.onload = resolve;
      sdk.onerror = reject;
      document.head.append(sdk);
    });
    const admission = await fetch('./admission', { method: 'POST' });
    if (admission.status === 401) {
      offerLogin(nav, status);
      return null;
    }
    if (!admission.ok) {
      const reason = await admission.json();
      if (reason.error === 'already_joined') {
        offerReentry(nav, status, '기존 접속이 남아 있습니다. 기존 접속이 끝난 뒤 다시 입장해 주세요.');
        return null;
      }
      throw Error();
    }
    const client = new Colyseus.Client('wss://' + location.host);
    const { memberId, ...seat } = await admission.json();
    const room = await client.consumeSeatReservation(seat);
    showActivityGuide(room, memberId);
    return room;
  } catch {
    offerReentry(nav, status, '채널에 연결하지 못했습니다. 잠시 후 다시 입장해 주세요.');
    return null;
  }
}
