import {edmSeats} from './edm-layout.js';
export const tableMatchRules=Object.freeze({inviteMs:20000,chooseMs:20000,resultMs:15000});
export function seatedTable(actor){
 if(!actor||actor.ai||!Number.isInteger(actor.seat))return null;
 const seat=edmSeats[actor.seat];
 if(seat?.table)return {id:'floor-'+seat.table,label:'1층 '+seat.table+'번 테이블'};
 if(seat?.balcony)return {id:'upper-'+seat.area,label:seat.label.replace(/ 소파.*$/,'')};
 return null;
}
export function tableMatch({actors,now=()=>Date.now()}){
 const games=new Map();
 const people=table=>actors().filter(a=>seatedTable(a)?.id===table);
 function selecting(g){
  if(g.accepted.size<2){games.delete(g.table);return;}
  g.phase='choose';g.until=now()+tableMatchRules.chooseMs;
 }
 function advance(){
  for(const g of games.values()){
   const ids=new Set(people(g.table).map(a=>a.id));
   for(const id of g.invited)if(!ids.has(id)){g.invited.delete(id);g.accepted.delete(id);g.answered.delete(id);g.choices.delete(id);}
   for(const [from,to]of g.choices)if(to!==null&&!g.accepted.has(to))g.choices.delete(from);
   if(g.phase==='invite'){
    if(g.invited.size<2){games.delete(g.table);continue;}
    if(now()>=g.until||g.answered.size===g.invited.size)selecting(g);
   }
   if(!games.has(g.table))continue;
   if(g.phase!=='invite'&&g.accepted.size<2){games.delete(g.table);continue;}
   if(g.phase==='choose'&&(now()>=g.until||[...g.accepted].every(id=>g.choices.has(id)))){g.phase='result';g.until=now()+tableMatchRules.resultMs;}
   else if(g.phase==='result'&&now()>=g.until)games.delete(g.table);
  }
 }
 function command(who,input={}){
  advance();const table=seatedTable(actors().find(a=>a.id===who));
  if(!table)return {error:'같은 테이블의 소파에 앉은 실제 방문객만 참여할 수 있습니다.'};
  const current=games.get(table.id),action=input?.action;
  if(action==='propose'){
   if(current)return {error:'이 테이블에서는 이미 게임이 진행 중입니다.'};
   const invited=new Set(people(table.id).map(a=>a.id));
   if(invited.size<2)return {error:'같은 테이블에 실제 방문객이 2명 이상 앉아 있어야 합니다.'};
   games.set(table.id,{id:crypto.randomUUID(),table:table.id,phase:'invite',until:now()+tableMatchRules.inviteMs,invited,answered:new Set([who]),accepted:new Set([who]),choices:new Map()});return {ok:true};
  }
  if(!current||input.gameId!==current.id||!current.invited.has(who))return {error:'현재 테이블의 게임을 다시 확인해 주세요.'};
  if(action==='decline'||action==='leave'){
   current.answered.add(who);current.accepted.delete(who);current.choices.delete(who);
   if(current.phase!=='invite')current.invited.delete(who);advance();return {ok:true};
  }
  if(action==='join'&&current.phase==='invite'){
   current.answered.add(who);current.accepted.add(who);advance();return {ok:true};
  }
  if(action==='choose'&&current.phase==='choose'&&current.accepted.has(who)){
   if(input.to!==null&&(input.to===who||!current.accepted.has(input.to)))return {error:'참여 중인 다른 상대를 선택해 주세요.'};
   current.choices.set(who,input.to);advance();return {ok:true};
  }
  return {error:'현재 단계에서는 사용할 수 없는 요청입니다.'};
 }
 function view(who){
  advance();const table=seatedTable(actors().find(a=>a.id===who));
  if(!table)return {available:false,table:null,game:null};
  const g=games.get(table.id),base={available:true,table:table.label,people:people(table.id).length,game:null};
  if(!g)return base;
  const accepted=g.accepted.has(who),invited=g.invited.has(who);
  if(!invited||(g.phase!=='invite'&&!accepted))return {...base,game:{phase:'busy'}};
  const players=people(g.table).filter(a=>g.accepted.has(a.id)).map(a=>({id:a.id,name:a.nickname}));
  const game={id:g.id,phase:g.phase,until:g.until,accepted,answered:g.answered.has(who),players,self:who,chosen:g.choices.has(who),choice:g.choices.get(who)??null};
  if(g.phase==='result'&&accepted)game.edges=[...g.choices].filter(([from,to])=>to!==null&&g.accepted.has(from)&&g.accepted.has(to)).map(([from,to])=>({from,to,mutual:g.choices.get(to)===from}));
  return {...base,game};
 }
 return {command,view};
}
