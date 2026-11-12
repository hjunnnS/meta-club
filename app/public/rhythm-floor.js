import {edmFloor} from './edm-layout.js';
// All depth is optical: collision height stays flat and the seating routes are unchanged.
export function rhythmFloor(B,scene){
  const mesh=B.MeshBuilder.CreateGround('dance floor keys',{width:edmFloor.width,height:edmFloor.depth},scene);
  mesh.position.set(0,.042,edmFloor.centerZ);mesh.isPickable=false;
  const material=new B.ShaderMaterial('infinity LED and starlight floor',scene,{
    vertexSource:`precision highp float;
      attribute vec3 position;uniform mat4 world,worldViewProjection;
      varying vec2 p;varying vec3 worldPoint;
      void main(){p=position.xz;worldPoint=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`,
    fragmentSource:`precision highp float;
      varying vec2 p;varying vec3 worldPoint;
      uniform vec3 eye,primary,secondary;
      uniform float beat,mode,previousMode,modeMix,energy,intensity,accent,flash,cueBeat,reduced;
      float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
      vec3 spectrum(float h){return .53+.47*cos(6.283185*(h+vec3(0.,.67,.33)));}
      float border(vec2 q,float extent,float width){return 1.-smoothstep(width,width*2.4,abs(max(abs(q.x),abs(q.y))-extent));}
      vec3 infinityTiles(float wave){
        const float size=1.60;
        vec2 grid=p/size,cell=floor(grid),uv=fract(grid)-.5;
        float inside=1.-smoothstep(.475,.49,max(abs(uv.x),abs(uv.y)));
        vec3 view=normalize(worldPoint-eye);
        vec2 parallax=clamp(view.xz/max(.24,abs(view.y)),vec2(-2.3),vec2(2.3));
        float hue=p.x*.020+beat*.012+wave*.18;
        vec3 neon=mix(mix(primary,secondary,clamp((p.x+10.)/20.,0.,1.)),spectrum(hue),.55);
        float pulse=exp(-fract(beat)*7.)*(.25+.75*energy);
        float flow=.5+.5*sin((abs(cell.x)+abs(cell.y))*.8-beat*.9);
        float lit=.58+.22*flow+.20*pulse;
        vec3 color=neon*.024;
        // Offset repeated illuminated borders with the real camera direction.
        // The dark centre and receding dot rows suggest a mirrored well under glass.
        for(int i=0;i<8;i++){
          float layer=float(i),extent=.448-layer*.029;
          vec2 q=uv+parallax*(layer*.035/size);
          float edge=border(q,extent,.0045);
          float inner=1.-smoothstep(extent,extent+.015,max(abs(q.x),abs(q.y)));
          float dots=pow(.5+.5*cos((abs(q.x)>abs(q.y)?q.y:q.x)*176.),6.);
          float fade=pow(.78,layer);
          color+=neon*edge*fade*(.22+.78*dots)*lit;
          color+=neon*border(q,extent,.020)*fade*.045;
          if(i==7)color+=neon*inner*.045;
        }
        float pane=border(uv,.466,.006);
        float front=.5+.5*cos((cell.x+cell.y)*.65-beat*.85);
        if(wave>.5){color+=neon*inside*pow(front,5.)*(.11+.10*pulse);}
        color+=neon*pane*(.32+.23*pulse);
        color+=mix(neon,vec3(1.),.20)*border(uv,.473,.002)*.15;
        return mix(vec3(.006,.008,.015),color,inside);
      }
      vec3 stars(float green){
        vec3 tint=mix(vec3(.42,.16,.67),vec3(.17,.46,.26),green);
        vec3 color=tint*.065;
        // Several independently seeded fields give points different sizes and depth.
        for(int i=0;i<3;i++){
          float layer=float(i),spacing=.62+layer*.19;
          vec3 view=normalize(worldPoint-eye);
          vec2 q=(p+clamp(view.xz/max(.3,abs(view.y)),vec2(-2.),vec2(2.))*layer*.07)/spacing;
          vec2 cell=floor(q),uv=fract(q),seed=cell+layer*71.3;
          vec2 at=.12+.76*vec2(hash(seed),hash(seed+31.7));
          float d=length(uv-at),random=hash(seed+12.1);
          float radius=.012+.010*random;
          float twinkle=mix(.70+.30*sin(beat*.55+random*32.),1.,reduced);
          float core=1.-smoothstep(radius*.35,radius,d);
          float halo=exp(-d*d/.0025)*.055;
          float sparkle=(1.-smoothstep(.002,.006,abs(uv.x-at.x)))*(1.-smoothstep(.012,.065,abs(uv.y-at.y)))+
                        (1.-smoothstep(.002,.006,abs(uv.y-at.y)))*(1.-smoothstep(.012,.065,abs(uv.x-at.x)));
          float hit=exp(-fract(beat)*6.)*energy*(random>.88?1.:.12);
          vec3 star=mix(tint,vec3(.92,.96,1.),.76);
          color+=star*(core*(.62+.25*hit)+halo+sparkle*.12)*twinkle/(1.+layer*.65);
        }
        return color;
      }
      vec3 surface(float kind){
        if(kind>.5&&kind<1.5)return stars(0.);
        if(kind>2.5)return stars(1.);
        return infinityTiles(kind>1.5?1.:0.);
      }
      void main(){
        vec3 color=surface(mode);
        if(abs(previousMode-mode)>.1&&modeMix<.999)color=mix(surface(previousMode),color,modeMix);
        // Existing stage-to-floor handoff adds color, without bleaching the star field.
        float relay=0.;
        if(cueBeat>=1.8&&cueBeat<5.2){
          float travel=smoothstep(2.14,5.2,cueBeat),front=mix(9.2,28.,travel);
          relay=(1.-smoothstep(.3,2.1,abs(length(p-vec2(0.,-17.))-front)))*.10;
        }
        color+=secondary*(relay+accent*.025+flash*.035);
        color*=.72+.28*clamp(intensity,0.,1.);
        gl_FragColor=vec4(color,1.);
      }`
  },{attributes:['position'],uniforms:['world','worldViewProjection','eye','primary','secondary','beat','mode','previousMode','modeMix','energy','intensity','accent','flash','cueBeat','reduced']});
  material.backFaceCulling=false;mesh.material=material;
  // Avoid a uniform glow pass turning the dark glass into a white sheet.
  for(const layer of scene.effectLayers||[])if(typeof layer.addExcludedMesh==='function')layer.addExcludedMesh(mesh);
  const calm=matchMedia('(prefers-reduced-motion: reduce)');
  let lastMode=0,previous=0,changedAt=performance.now();
  return (beat,celebrating,accent,cueBeat,cueColor,pattern=0,flash=0,look=null,playing=false,bass=0)=>{
    const active=playing&&!calm.matches,b=active?Math.max(0,beat):0;
    const wanted=calm.matches?1:active?(pattern===1?2:pattern===2?1:Math.floor(b/16)%4):0;
    if(wanted!==lastMode){previous=lastMode;lastMode=wanted;changedAt=performance.now();}
    const age=Math.min(1,(performance.now()-changedAt)/550),mix=age*age*(3-2*age);
    material.setFloat('mode',lastMode);material.setFloat('previousMode',previous);material.setFloat('modeMix',mix);
    material.setVector3('eye',scene.activeCamera.globalPosition||scene.activeCamera.position);
    material.setColor3('primary',B.Color3.FromHexString(look?.primary||'#9e6dff'));
    material.setColor3('secondary',B.Color3.FromHexString(look?.secondary||'#8cdbff'));
    material.setFloat('beat',b);material.setFloat('energy',active?Math.max(0,Math.min(1,bass||0)):0);
    material.setFloat('intensity',look?.floor??.8);material.setFloat('accent',active?accent:0);
    material.setFloat('flash',active?Math.max(0,Math.min(1,flash)):0);
    material.setFloat('cueBeat',active?cueBeat:-1);material.setFloat('reduced',calm.matches?1:0);
  };
}
