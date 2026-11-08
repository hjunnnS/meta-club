import { connected } from './club-room.js';
import { localTest } from './local-test.js';
import { blockedMessage } from './message-filter.js';
import { mockOrder, requestMockOrder, finishMockRequest } from './store.js';

const led = {
  id: 'edm-led',
  title: 'EDM 축하 LED 메시지',
  price: 1000,
  seconds: 15,
  conditions: [
    '축하 문구를 구매한 EDM 채널의 무대 전광판에 한 번 표시합니다.',
    '시험 회원의 모의 결제이며 실청구는 없습니다.',
    '시간 예약 없이 서버 결제 승인 순으로 실행합니다. 동시 승인 시 서버 접수 순번을 따릅니다. 대기 중에는 만료되지 않습니다.',
    '금지 문구는 구매 전에 거절합니다. 시스템 오류로 미실행되면 이용권을 보존해 한 번 재시도하고, 다시 실패하면 전액 모의 취소합니다.',
    '운영자가 정책 위반으로 중단한 경우 사유를 기록하고 재실행·환불하지 않습니다.',
  ],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function installShop(app) {
  if (!localTest) return;
  const path = '/api/account/edm-shop';
  app.use(path, (req, res, next) => {
    if (!res.locals.account.id.startsWith('local-test:')) return res.sendStatus(403);
    next();
  });
  app.get(path, (_req, res) => res.json(led));
  function selection(req, res, next) {
    const { product, channel, message } = req.body ?? {};
    if (
      product !== led.id ||
      !channel ||
      connected.get(res.locals.account.id)?.room.roomId !== channel
    )
      return res.status(409).json({ error: '현재 EDM 채널에서 다시 선택해 주세요.' });
    if (
      typeof message !== 'string' ||
      !message.trim() ||
      Array.from(message).length > 80 ||
      /[\p{Cc}\p{Cf}]/u.test(message) ||
      blockedMessage(message)
    )
      return res
        .status(422)
        .json({ error: '문구를 확인해 주세요. 금지 문구 없이 1~80자로 입력하세요.' });
    res.locals.message = message.trim();
    next();
  }
  app.post(path + '/preview', selection, (_req, res) =>
    res.json({ message: res.locals.message, seconds: led.seconds }),
  );
  app.get(path + '/orders/:intent', (req, res) => {
    const order = mockOrder(res.locals.account.id, req.params.intent);
    return order ? res.json(order) : res.sendStatus(404);
  });
  app.post(path + '/orders', selection, (req, res) => {
    const { intent, channel } = req.body;
    if (typeof intent !== 'string' || !uuid.test(intent)) return res.sendStatus(400);
    const order = requestMockOrder(
      res.locals.account.id,
      intent,
      channel,
      led.id,
      res.locals.message,
      led.price,
    );
    if (
      order.channel !== channel ||
      order.product !== led.id ||
      order.message !== res.locals.message
    )
      return res.status(409).json({ error: '같은 주문 번호의 상품 조건이 다릅니다.' });
    res.json(order);
  });
  app.post(path + '/orders/:intent/result', (req, res) => {
    const account = res.locals.account.id,
      intent = req.params.intent;
    const outcome = req.body?.outcome;
    if (!['cancelled', 'declined', 'awaiting_verification'].includes(outcome))
      return res.sendStatus(400);
    const previous = mockOrder(account, intent);
    if (!previous) return res.sendStatus(404);
    if (
      outcome === 'awaiting_verification' &&
      previous.status === 'requested' &&
      connected.get(account)?.room.roomId !== previous.channel
    )
      return res.sendStatus(409);
    const order = finishMockRequest(account, intent, outcome);
    if (order.status !== outcome)
      return res.status(409).json({ error: '이미 처리된 주문입니다.', order });
    res.json(order);
  });
}
