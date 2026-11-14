// Trial palettes only: no prices, inventory, ownership or sales policy.
export const wandThemes=Object.freeze([
  {id:'default',label:'기본 하늘색',rod:'#67fff2',core:'#2bd8ff',edge:'#102340'},
  {id:'violet',label:'라벤더',rod:'#c4a3ff',core:'#aa86ff',edge:'#21113d'},
  {id:'rose',label:'로즈 핑크',rod:'#ffade0',core:'#ff78ca',edge:'#391126'},
  {id:'gold',label:'웜 골드',rod:'#ffe294',core:'#ffc562',edge:'#372613'},
]);
export const wandDecorations=[['none','장식 없음'],['star','둥근 별'],['heart','하트'],['cloud','구름']];
export const wandSizes=[['default','기본 크기']];
export const wandTrails=[['default','기본 궤적'],['double','두 겹 빛줄기'],['sparkles','별가루 궤적']];
export function validWandStyle(value){
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).every(k=>['color','decoration','trail','size'].includes(k))
    &&wandThemes.some(t=>t.id===value.color)&&wandDecorations.some(([id])=>id===value.decoration)&&wandTrails.some(([id])=>id===value.trail)&&(value.size===undefined||wandSizes.some(([id])=>id===value.size)));
}
export function normalizeWandStyle(value){
  if(value?.decoration==='crown')value={...value,decoration:'cloud'};
  return {color:wandThemes.some(t=>t.id===value?.color)?value.color:'default',decoration:wandDecorations.some(([id])=>id===value?.decoration)?value.decoration:'none',trail:wandTrails.some(([id])=>id===value?.trail)?value.trail:'default',size:wandSizes.some(([id])=>id===value?.size)?value.size:'default'};
}
export function wandTheme(value){return wandThemes.find(t=>t.id===value?.color)||wandThemes[0];}

export function wandCustomization(root,send,frame){
  const select=root.querySelector('select'),status=root.querySelector('output');
  const decoration=root.querySelector('[data-wand-decoration]'),trail=root.querySelector('[data-wand-trail]');
  for(const [id,label]of wandDecorations)decoration.append(new Option(label,id));
  for(const [id,label]of wandTrails)trail.append(new Option(label,id));

  const sync=()=>{select.value=draft.color;decoration.value=draft.decoration;trail.value=draft.trail;};
  let applied=normalizeWandStyle(),draft={...applied},dirty=false,preview=false,enabled=false;
  for(const theme of wandThemes){
    const option=document.createElement('option');option.value=theme.id;option.textContent=theme.label;select.append(option);
  }
  const clearPreview=()=>{preview=false;frame('wand-preview',null);};
  const showStatus=message=>{status.textContent=message;};
  select.onchange=decoration.onchange=trail.onchange=()=>{
    draft=normalizeWandStyle({color:select.value,decoration:decoration.value,trail:trail.value,size:'default'});dirty=true;
    if(preview)frame('wand-preview',draft);
    showStatus(preview?'내 화면에서만 미리보기 중':'꾸미기를 골랐습니다. 미리보기 또는 적용을 눌러 주세요.');
  };
  root.querySelector('[data-wand-preview]').onclick=()=>{
    if(!enabled)return;preview=true;frame('wand-preview',draft);
    showStatus('내 화면에서만 미리보기 중 · 적용 전 선택은 공유되지 않습니다.');
  };
  root.querySelector('[data-wand-apply]').onclick=()=>{
    if(!enabled)return;send('wand-style',{...draft});send('wand',true);dirty=false;clearPreview();
    showStatus('선택한 꾸미기를 체험에 적용했습니다.');
  };
  root.querySelector('[data-wand-cancel]').onclick=()=>{
    draft={...applied};sync();dirty=false;clearPreview();showStatus('미리보기를 끝내고 적용된 색으로 돌아왔습니다.');
  };
  root.querySelector('[data-wand-reset]').onclick=()=>{
    if(!enabled)return;draft=normalizeWandStyle();sync();dirty=false;
    send('wand-style',{...draft});clearPreview();showStatus('기본 하늘색·장식 없음·기본 궤적으로 되돌렸습니다.');
  };
  root.addEventListener('toggle',()=>{if(!root.open&&preview)clearPreview();});
  return {
    update(actor,available){
      enabled=Boolean(actor&&available);root.hidden=!enabled;
      if(!enabled){root.open=false;dirty=false;if(preview)clearPreview();return;}
      applied=normalizeWandStyle(actor.wandStyle);
      if(!dirty&&!preview){draft={...applied};sync();}
    },
    resume(){if(preview)frame('wand-preview',draft);},
  };
}
