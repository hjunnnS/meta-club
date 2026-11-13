// Trial palettes only: no prices, inventory, ownership or sales policy.
export const wandThemes=Object.freeze([
  {id:'default',label:'기본 하늘색',rod:'#67fff2',core:'#2bd8ff',edge:'#102340'},
  {id:'violet',label:'라벤더',rod:'#c4a3ff',core:'#aa86ff',edge:'#21113d'},
  {id:'rose',label:'로즈 핑크',rod:'#ffade0',core:'#ff78ca',edge:'#391126'},
  {id:'gold',label:'웜 골드',rod:'#ffe294',core:'#ffc562',edge:'#372613'},
]);
export function validWandStyle(value){
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).every(k=>['color','decoration','trail'].includes(k))
    &&wandThemes.some(t=>t.id===value.color)&&value.decoration==='none'&&value.trail==='default');
}
export function normalizeWandStyle(value){
  return {color:wandThemes.some(t=>t.id===value?.color)?value.color:'default',decoration:'none',trail:'default'};
}
export function wandTheme(value){return wandThemes.find(t=>t.id===value?.color)||wandThemes[0];}

export function wandCustomization(root,send,frame){
  const select=root.querySelector('select'),status=root.querySelector('output');
  let applied=normalizeWandStyle(),draft={...applied},dirty=false,preview=false,enabled=false;
  for(const theme of wandThemes){
    const option=document.createElement('option');option.value=theme.id;option.textContent=theme.label;select.append(option);
  }
  const clearPreview=()=>{preview=false;frame('wand-preview',null);};
  const showStatus=message=>{status.textContent=message;};
  select.onchange=()=>{
    draft=normalizeWandStyle({color:select.value});dirty=true;
    if(preview)frame('wand-preview',draft);
    showStatus(preview?'내 화면에서만 미리보기 중':'색을 골랐습니다. 미리보기 또는 적용을 눌러 주세요.');
  };
  root.querySelector('[data-wand-preview]').onclick=()=>{
    if(!enabled)return;preview=true;frame('wand-preview',draft);
    showStatus('내 화면에서만 미리보기 중 · 적용 전 선택은 공유되지 않습니다.');
  };
  root.querySelector('[data-wand-apply]').onclick=()=>{
    if(!enabled)return;send('wand-style',{...draft});send('wand',true);dirty=false;clearPreview();
    showStatus('선택한 색을 체험에 적용했습니다.');
  };
  root.querySelector('[data-wand-cancel]').onclick=()=>{
    draft={...applied};select.value=draft.color;dirty=false;clearPreview();showStatus('미리보기를 끝내고 적용된 색으로 돌아왔습니다.');
  };
  root.querySelector('[data-wand-reset]').onclick=()=>{
    if(!enabled)return;draft=normalizeWandStyle();select.value=draft.color;dirty=false;
    send('wand-style',{...draft});clearPreview();showStatus('기본 하늘색으로 되돌렸습니다.');
  };
  root.addEventListener('toggle',()=>{if(!root.open&&preview)clearPreview();});
  return {
    update(actor,available){
      enabled=Boolean(actor&&available);root.hidden=!enabled;
      if(!enabled){root.open=false;dirty=false;if(preview)clearPreview();return;}
      applied=normalizeWandStyle(actor.wandStyle);
      if(!dirty&&!preview){draft={...applied};select.value=draft.color;}
    },
    resume(){if(preview)frame('wand-preview',draft);},
  };
}
