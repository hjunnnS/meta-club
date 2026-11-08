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
    return await client.consumeSeatReservation(await admission.json());
  } catch {
    offerReentry(nav, status, '채널에 연결하지 못했습니다. 잠시 후 다시 입장해 주세요.');
    return null;
  }
}
