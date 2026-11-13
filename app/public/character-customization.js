import {appearanceOptions,appearanceColors,defaultAppearance,normalizeAppearance} from './character-appearance.js';
export function characterCustomization(root,send,frame){
 const fields=root.querySelector('[data-character-fields]'),status=root.querySelector('output');
 const names={hair:'헤어',top:'상의',bottom:'하의',glasses:'안경',hairColor:'머리 색상',topColor:'상의 색상',bottomColor:'하의 색상',glassesColor:'안경 색상'};
 const selects={};let applied=null,draft={...defaultAppearance},preview=false,dirty=false,enabled=false;
 for(const key of Object.keys(names)){
  const label=document.createElement('label');label.append(names[key]+' ');const select=document.createElement('select');select.setAttribute('aria-label','캐릭터 '+names[key]);
  for(const [id,text]of appearanceOptions[key]||appearanceColors)select.append(new Option(text,id));
  label.append(select);fields.append(label);selects[key]=select;
  select.onchange=()=>{draft=normalizeAppearance(Object.fromEntries(Object.entries(selects).map(([k,s])=>[k,s.value])));dirty=true;if(preview)frame('character-preview',draft);status.textContent='선택한 모습으로 미리보기 또는 적용할 수 있습니다.';};
 }
 const sync=()=>{for(const [key,select]of Object.entries(selects))select.value=draft[key];};sync();
 const cancel=()=>{preview=false;frame('character-preview',null);};
 root.querySelector('[data-character-preview]').onclick=()=>{if(!enabled)return;preview=true;frame('character-preview',draft);status.textContent='내 캐릭터에 미리보기 중 · 적용 전 모습은 공유되지 않습니다.';};
 root.querySelector('[data-character-apply]').onclick=()=>{if(!enabled)return;send('character-style',{...draft});dirty=false;cancel();status.textContent='선택한 꾸미기를 적용했습니다. 이번 접속에서 유지됩니다.';};
 root.querySelector('[data-character-cancel]').onclick=()=>{draft=normalizeAppearance(applied);sync();dirty=false;cancel();status.textContent='미리보기를 취소했습니다.';};
 root.querySelector('[data-character-reset]').onclick=()=>{if(!enabled)return;send('character-style',null);draft={...defaultAppearance};sync();dirty=false;cancel();status.textContent='기존 기본 캐릭터로 돌아왔습니다.';};
 root.addEventListener('toggle',()=>{if(!root.open&&preview)cancel();});
 return {update(actor,available){enabled=Boolean(actor&&available);root.hidden=!enabled;if(!enabled){root.open=false;dirty=false;if(preview)cancel();return;}applied=actor.appearance||null;if(!dirty&&!preview){draft=normalizeAppearance(applied);sync();}},resume(){if(preview)frame('character-preview',draft);}};
}
