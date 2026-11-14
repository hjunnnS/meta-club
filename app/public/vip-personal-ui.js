export function vipPersonalUI(root,send){
 const dance=root.querySelector('[data-vip-solo]'),fan=root.querySelector('[data-vip-fan]'),status=root.querySelector('[data-vip-personal-status]');let actor=null;
 dance.onclick=()=>send('vip-solo',actor?.action!=='vip-solo');fan.onclick=()=>send('vip-fan',actor?.danceProp!=='fan');
 return {update(next,enabled){actor=next;root.hidden=!enabled;if(!enabled)return;
  const busy=actor.seat!=null||actor.trainSlot!=null||['pole-dance','podium-dance'].includes(actor.action),solo=actor.action==='vip-solo',hasFan=actor.danceProp==='fan';
  dance.disabled=busy;fan.disabled=busy&&!hasFan;
  dance.textContent=solo?'VIP 춤 멈추기':'VIP 춤 · 문워크·턴';dance.setAttribute('aria-pressed',String(solo));
  fan.textContent=hasFan?'LED 부채 내리기':'LED 부채 들기';fan.setAttribute('aria-pressed',String(hasFan));
  status.textContent='';
 }};
}
