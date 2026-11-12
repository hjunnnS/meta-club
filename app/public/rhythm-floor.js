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
      uniform float beat,mode,previousMode,modeMix,energy,intensity,accent,flash,cueBeat,reduced,tilePlaying;
      float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
      vec3 spectrum(float h){return .53+.47*cos(6.283185*(h+vec3(0.,.67,.33)));}
      float border(vec2 q,float extent,float width){return 1.-smoothstep(width,width*2.4,abs(max(abs(q.x),abs(q.y))-extent));}
      // A group cue is brightness, palette offset and apparent block elevation.
      vec3 tileGroup(float style,vec2 cell){
        if(tilePlaying<.5)return vec3(.72,0.,0.);
        vec2 c=cell+.5;
        float radius=max(abs(c.x),abs(c.y));
        if(style<.5){
          float travel=mod(beat*.75,7.);
          travel=mix(travel,6.5-travel,mod(floor(beat/64.),2.));
          float head=1.-smoothstep(.35,1.05,abs(radius-travel));
          float trail=(1.-smoothstep(.3,1.,abs(radius-travel+1.)))*.23;
          return vec3(.025+.975*max(head,trail),radius*.07,.10*head);
        }
        if(style<1.5){
          float center=1.-step(2.5,radius),exchange=mod(floor(beat/2.),2.);
          float onZone=mix(center,1.-center,exchange);
          return vec3(.09+.91*onZone,mix(.02,.45,center)+exchange*.16,.17*onZone);
        }
        if(style<2.5){
          float direction=mod(floor(beat/16.),3.);
          float coordinate=direction<.5?c.x:direction<1.5?c.y:(c.x+c.y)*.65;
          float stripe=mod(coordinate+18.-floor(beat),12.);
          float next=mod(stripe-1.+12.,12.);
          float current=1.-smoothstep(.8,1.7,stripe);
          float following=1.-smoothstep(.8,1.7,next);
          float head=mix(current,following,smoothstep(.12,.88,fract(beat)));
          float tail=(1.-smoothstep(.6,1.7,abs(stripe-11.)))*.24;
          return vec3(.025+.975*max(head,tail),coordinate*.04,.12*head);
        }
        vec2 block=floor((cell+6.)/2.);
        float lift=smoothstep(.18,.85,.5+.5*sin(beat*.785398-block.x*.9-block.y*.9));
        float on=smoothstep(.15,.6,lift);
        return vec3(.025+.975*on,block.x*.11+block.y*.08,lift);
      }
      vec3 infinityTiles(float wave){
        const float size=1.60;
        vec2 grid=p/size,cell=floor(grid),uv=fract(grid)-.5;
        float inside=1.-smoothstep(.475,.49,max(abs(uv.x),abs(uv.y)));
        vec3 view=normalize(worldPoint-eye);
        vec2 parallax=clamp(view.xz/max(.24,abs(view.y)),vec2(-2.3),vec2(2.3));
        float hue=p.x*.020+beat*.012+wave*.18;
        vec3 neon=mix(mix(primary,secondary,clamp((p.x+10.)/20.,0.,1.)),spectrum(hue),.55);
        float pulse=exp(-fract(beat)*7.)*(.25+.75*energy);
        // Two cues per tile section; the next tile section uses the other two.
        // Starlight sections keep their existing timing and rendering unchanged.
        float section=floor(beat/8.),before=max(0.,section-1.);
        float style=mod(section+floor(section/2.),4.);
        float oldStyle=mod(before+floor(before/2.),4.);
        vec3 group=mix(tileGroup(oldStyle,cell),tileGroup(style,cell),smoothstep(0.,.65,mod(beat,8.)));
        neon=mix(neon,spectrum(group.y+beat*.005),.68);
        float lit=group.x*(.72+.28*pulse);
        vec3 color=neon*.024;
        // Offset repeated illuminated borders with the real camera direction.
        // The dark centre and receding dot rows suggest a mirrored well under glass.
        for(int i=0;i<8;i++){
          float layer=float(i),extent=.448-layer*(.029+.006*group.z);
          vec2 q=uv+parallax*(layer*(.035+.035*group.z)/size);
          float edge=border(q,extent,.0045);
          float inner=1.-smoothstep(extent,extent+.015,max(abs(q.x),abs(q.y)));
          float dots=pow(.5+.5*cos((abs(q.x)>abs(q.y)?q.y:q.x)*176.),6.);
          float fade=pow(.78,layer);
          color+=neon*edge*fade*(.22+.78*dots)*lit;
          color+=neon*border(q,extent,.020)*fade*.045*lit;
          if(i==7)color+=neon*inner*.045*lit;
        }
        float pane=border(uv,.466,.006);
        // A displaced bright top and shaded skirt suggest rising 2x2 blocks.
        // This is a view-dependent image on glass, never a physical moving floor.
        vec2 topUV=uv-parallax*group.z*.095;
        float top=1.-smoothstep(.31,.34,max(abs(topUV.x),abs(topUV.y)));
        float skirt=max(0.,1.-smoothstep(.40,.44,max(abs(uv.x),abs(uv.y)))-top);
        color+=neon*(top*.22+skirt*.045)*group.z*group.x;
        color+=neon*pane*(.025+(.30+.20*pulse)*group.x);
        color+=mix(neon,vec3(1.),.20)*border(uv,.473,.002)*(.012+.13*group.x);
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
  },{attributes:['position'],uniforms:['world','worldViewProjection','eye','primary','secondary','beat','mode','previousMode','modeMix','energy','intensity','accent','flash','cueBeat','reduced','tilePlaying']});
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
    material.setFloat('cueBeat',active?cueBeat:-1);material.setFloat('reduced',calm.matches?1:0);material.setFloat('tilePlaying',active?1:0);
  };
}
