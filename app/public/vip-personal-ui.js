import {vipTableAnchor} from './vip-personal.js';
export function vipPersonalUI(root,send){
 const dance=root.querySelector('[data-vip-solo]'),fan=root.querySelector('[data-vip-fan]'),tower=root.querySelector('[data-vip-tower]'),status=root.querySelector('[data-vip-personal-status]');let actor=null;
 dance.onclick=()=>send('vip-solo',actor?.action!=='vip-solo');fan.onclick=()=>send('vip-fan',actor?.danceProp!=='fan');tower.onclick=()=>send('vip-tower',actor?.vipTowerSeat!==actor?.seat);
 return {update(next,enabled){actor=next;root.hidden=!enabled;if(!enabled)return;
  const busy=actor.seat!=null||actor.trainSlot!=null||['pole-dance','podium-dance'].includes(actor.action),solo=actor.action==='vip-solo',hasFan=actor.danceProp==='fan';
  dance.disabled=busy;fan.disabled=busy&&!hasFan;tower.disabled=!vipTableAnchor(actor);
  dance.textContent=solo?'VIP 춤 멈추기':'VIP 춤 · 문워크·턴';dance.setAttribute('aria-pressed',String(solo));
  fan.textContent=hasFan?'LED 부채 내리기':'LED 부채 들기';fan.setAttribute('aria-pressed',String(hasFan));
  const on=actor.vipTowerSeat===actor.seat&&actor.seat!=null;
  tower.textContent=on?'샴페인 타워 치우기':'미니 샴페인 타워 켜기';tower.setAttribute('aria-pressed',String(on));
  status.textContent=vipTableAnchor(actor)?'샴페인 타워는 앉은 테이블 위에 표시되고 일어나면 종료됩니다.':'테이블에 앉으면 샴페인 타워를 사용할 수 있습니다.';
 }};
}
