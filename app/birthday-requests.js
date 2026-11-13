// Ephemeral, same-room requests. No payments, inventory or automatic consent.
export function birthdayRequests(actors,start){
  const rows=new Map();let sequence=0;
  const actor=id=>actors().find(a=>a.id===id);
  const pending=r=>r.status==='pending';
  const finish=(r,status)=>{r.status=status;r.updated=Date.now();return {...r};};
  return {
    propose(from,to){
      const sender=actor(from),target=actor(to);
      if(!sender||!target||from===to)return {error:'같은 클럽의 다른 대상을 선택해 주세요.'};
      const existing=[...rows.values()].find(r=>r.from===from&&pending(r));
      if(existing)return {...existing};
      // Bound completed history without expiring or auto-accepting pending requests.
      const completed=[...rows.values()].filter(r=>!pending(r));
      while(completed.length>63)rows.delete(completed.shift().id);
      const row={id:'birthday-'+Date.now()+'-'+ ++sequence,kind:'birthday',from,to,
        sender:sender.nickname,target:target.nickname,status:'pending',created:Date.now()};
      rows.set(row.id,row);return {...row};
    },
    answer(who,id,accept){
      const row=rows.get(id);
      if(!row||row.to!==who||typeof accept!=='boolean')return {error:'응답할 수 없는 제안입니다.'};
      if(!pending(row))return {...row};
      if(!actor(row.from)||!actor(row.to))return finish(row,'unavailable');
      if(!accept)return finish(row,'declined');
      // Commit acceptance before starting: repeated replies never run it twice.
      finish(row,'accepted');
      const error=start({...row},actor(row.from),actor(row.to));
      if(error){row.message=error;return finish(row,'failed');}
      return {...row};
    },
    cancel(who,id){
      const row=rows.get(id);
      if(!row||row.from!==who)return {error:'취소할 수 없는 제안입니다.'};
      return pending(row)?finish(row,'cancelled'):{...row};
    },
    leave(id){for(const row of rows.values())if(pending(row)&&(row.from===id||row.to===id))finish(row,'unavailable');},
    state(id){
      for(const row of rows.values())if(pending(row)&&(!actor(row.from)||!actor(row.to)))finish(row,'unavailable');
      const mine=[...rows.values()].filter(r=>r.from===id||r.to===id).map(r=>({...r}));
      return {requests:mine,self:id};
    },
  };
}
