const root = '/api/account/edm-shop';
const el = (name) => document.getElementById('shop-' + name);
const status = {
  requested: '모의 결제 요청을 선택하세요.',
  awaiting_verification: '서버 결제 검증 대기 중입니다. 실청구 및 이용권 지급은 없습니다.',
  cancelled: '주문을 취소했습니다.',
  declined: '모의 결제가 거절됐습니다.',
};
async function api(path, body) {
  const res = await fetch(
    root + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(data?.error || '요청을 처리하지 못했습니다. 다시 시도하세요.');
    e.status = res.status;
    e.order = data?.order;
    throw e;
  }
  return data;
}
export function initShop(frame) {
  const dialog = el('dialog');
  let channel,
    key,
    product,
    order,
    intent,
    busy = false,
    timer,
    version = 0;
  function render() {
    el('select').hidden = Boolean(order);
    el('checkout').hidden = order?.status !== 'requested';
    el('new').hidden = !order || order.status === 'requested';
    el('message').disabled = Boolean(order) || busy;
    for (const b of dialog.querySelectorAll('button:not(#shop-close)'))
      b.disabled = busy || !product;
    if (order) {
      const confirm = el('checkout').querySelector('[data-result=awaiting_verification]');
      confirm.disabled = busy || order.channel !== channel;
      el('message').value = order.message;
      el('status').textContent =
        '시험 주문 ' + order.sequence + ' · 채널 ' + order.channel + ' · ' + status[order.status];
    }
  }
  async function run(fn) {
    if (busy || !channel) return;
    const ticket = version,
      isCurrent = () => ticket === version;
    let errorMessage;
    busy = true;
    render();
    try {
      await fn(isCurrent);
    } catch (e) {
      if (isCurrent()) {
        if (e.order) order = e.order;
        errorMessage = e.message;
      }
    } finally {
      if (isCurrent()) {
        busy = false;
        render();
        if (errorMessage) el('status').textContent = errorMessage;
      }
    }
  }
  function stop() {
    clearTimeout(timer);
    el('stop').hidden = true;
    frame('led-preview', null);
  }
  el('open').onclick = () =>
    run(async (current) => {
      stop();
      dialog.showModal();
      el('status').textContent = '불러오는 중…';
      const item = await api('');
      if (!current()) return;
      product = item;
      el('title').textContent = item.title;
      el('price').textContent =
        '시험 가격 ' + item.price.toLocaleString('ko-KR') + '원 · 1회 ' + item.seconds + '초';
      el('terms').replaceChildren(
        ...item.conditions.map((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }),
      );
      intent = sessionStorage.getItem(key);
      if (intent) {
        try {
          const saved = await api('/orders/' + intent);
          if (current()) order = saved;
        } catch (e) {
          if (e.status !== 404) throw e;
        }
      }
      if (current()) el('status').textContent = '';
    });
  const selection = () => ({ channel, product: product.id, message: el('message').value });
  el('preview').onclick = () =>
    run(async (current) => {
      const p = await api('/preview', selection());
      if (!current() || !dialog.open) return;
      dialog.close();
      frame('led-preview', p);
      el('stop').hidden = false;
      timer = setTimeout(stop, p.seconds * 1000);
    });
  el('stop').onclick = stop;
  el('order').onclick = () =>
    run(async (current) => {
      intent ??= crypto.randomUUID();
      sessionStorage.setItem(key, intent);
      const result = await api('/orders', { ...selection(), intent });
      if (current()) order = result;
    });
  for (const button of el('checkout').querySelectorAll('button'))
    button.onclick = () =>
      run(async (current) => {
        const result = await api('/orders/' + intent + '/result', {
          outcome: button.dataset.result,
        });
        if (current()) order = result;
      });
  el('new').onclick = () => {
    sessionStorage.removeItem(key);
    intent = order = null;
    el('status').textContent = '';
    render();
  };
  el('close').onclick = () => dialog.close();
  return {
    channel(id, member) {
      if (id === channel) return;
      version++;
      stop();
      dialog.close();
      busy = false;
      intent = order = product = null;
      channel = id;
      key = JSON.stringify(['edm-led-order', member]);
      el('open').hidden = !id;
      el('message').value = '';
      el('status').textContent = '';
      render();
    },
  };
}
