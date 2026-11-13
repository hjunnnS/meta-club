import {edmSeats,edmBalcony} from './edm-layout.js';
export const vipCommands=['vip-solo','vip-fan','vip-tower'];
export function vipTableAnchor(actor){
 const seat=Number.isInteger(actor?.seat)?edmSeats[actor.seat]:null;if(!seat)return null;
 if(seat.table){const center=edmSeats.find(s=>s.table===seat.table);return {key:'table-'+seat.table,x:18.20,y:.73,z:center.z-.28};}
 if(seat.balcony){const p=edmBalcony.pockets[seat.area],sx=-p.fz,sz=p.fx;return {key:'upper-'+seat.area,x:p.x+p.fx*1.70-sx*.08,y:4.52,z:p.z+p.fz*1.70-sz*.08};}
 return null;
}
// Preview controls, not ownership/payment/usage policy. Only the caller's fields change.
export function vipPersonalCommand(actors,actor,kind,on){
 if(!actor||!vipCommands.includes(kind)||typeof on!=='boolean')return {error:'활동 선택을 확인해 주세요.'};
 if(kind==='vip-tower'){
  if(!on){delete actor.vipTowerSeat;return {ok:true};}
  const anchor=vipTableAnchor(actor);if(!anchor||actor.action!=='sit')return {error:'1층 테이블이나 2층 소파에 앉은 뒤 사용해 주세요.'};
  if(actors.some(a=>a.id!==actor.id&&a.vipTowerSeat===a.seat&&vipTableAnchor(a)?.key===anchor.key))return {error:'이 테이블에 샴페인 타워가 이미 있습니다.'};
  actor.vipTowerSeat=actor.seat;return {ok:true};
 }
 if(!on){if(kind==='vip-solo'&&actor.action==='vip-solo')actor.action='idle';if(kind==='vip-fan')actor.danceProp=null;return {ok:true};}
 if(actor.seat!=null||actor.trainSlot!=null||['pole-dance','podium-dance'].includes(actor.action))return {error:'자리나 단상에서 나온 뒤 사용해 주세요.'};
 if(kind==='vip-solo')actor.action='vip-solo';
 else {actor.danceProp='fan';actor.wand=false;}
 return {ok:true};
}
