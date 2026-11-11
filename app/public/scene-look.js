// One musical look controls stage, floor and scenery without changing show times.
const palettes=[
  {primary:'#9e6dff',secondary:'#9deaff'},
  {primary:'#5d9dff',secondary:'#edf9ff'},
  {primary:'#ffce83',secondary:'#fff5df'},
];
export function sceneLook(beat,playing,arrangement=1,person=false){
 const b=playing?Math.max(0,beat):0,phase=b%32;
 const palette=palettes[Math.floor((b+2)/32)%palettes.length];
 const energyGate=Math.max(0,Math.min(1,(arrangement-.40)/.42));
 const gathering=playing&&phase>=28?(phase-28)/4*energyGate:0;
 const opening=playing&&b>=32&&phase<4&&arrangement>.5?(1-phase/4)*energyGate:0;
 const quiet=!playing||arrangement<.55;
 return {...palette,mode:opening>.05?'transition':gathering>.1?'build':'base',
  ambient:quiet?.30:.23+gathering*.09+opening*.20,
  decor:quiet?.24:.22+gathering*.10+opening*.13,
  beams:(quiet?.30:.48+gathering*.22+opening*.30)*(person?.55:1),
  floor:quiet?.46:.68+gathering*.14+opening*.18,
  white:opening*.72,person,gathering,opening};
}
