export const vipCommands=['vip-solo','vip-fan'];
// Preview controls, not ownership/payment/usage policy. Only the caller's fields change.
export function vipPersonalCommand(actors,actor,kind,on){
 if(!actor||!vipCommands.includes(kind)||typeof on!=='boolean')return {error:'활동 선택을 확인해 주세요.'};

 if(!on){if(kind==='vip-solo'&&actor.action==='vip-solo')actor.action='idle';if(kind==='vip-fan')actor.danceProp=null;return {ok:true};}
 if(actor.seat!=null||actor.trainSlot!=null||['pole-dance','podium-dance'].includes(actor.action))return {error:'자리나 단상에서 나온 뒤 사용해 주세요.'};
 if(kind==='vip-solo')actor.action='vip-solo';
 else {actor.danceProp='fan';actor.wand=false;}
 return {ok:true};
}
