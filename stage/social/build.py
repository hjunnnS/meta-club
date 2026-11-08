"""05d-3. Architectural blockout of the garden and its connected terraces (metres)."""
import json
import math
import random
import struct
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
TAU = 2 * math.pi
parts = defaultdict(lambda: ([], []))
palette = {
    'limestone': (.68,.59,.43), 'travertine': (.78,.71,.54), 'timber': (.47,.29,.15),
    'plank': (.64,.44,.23), 'cream': (.87,.79,.60), 'bronze': (.32,.22,.10),
    'sage': (.33,.45,.30), 'moss': (.15,.31,.19), 'leaf': (.27,.43,.23),
    'clay': (.53,.33,.23), 'rose': (.78,.40,.48), 'petal': (.95,.64,.66),
}

def triangle(name, mat, a, b, c):
    u=[j-i for i,j in zip(a,b)]; v=[j-i for i,j in zip(a,c)]
    n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    length=math.hypot(*n)
    if length>1e-8:
        pos,norm=parts[name,mat];pos.extend((a,b,c));norm.extend([tuple(k/length for k in n)]*3)

def quad(name,mat,a,b,c,d):
    triangle(name,mat,a,b,c);triangle(name,mat,a,c,d)

def beam(name,mat,a,b,r,sides=8):
    d=[(v-u)/math.dist(a,b) for u,v in zip(a,b)]
    horizontal=math.hypot(d[0],d[2])
    u=(d[2]/horizontal,0,-d[0]/horizontal) if horizontal else (1,0,0)
    v=(d[1]*u[2],d[2]*u[0]-d[0]*u[2],-d[1]*u[0])
    def pt(p,i):return tuple(p[k]+r*(u[k]*math.cos(TAU*i/sides)+v[k]*math.sin(TAU*i/sides)) for k in range(3))
    for i in range(sides):quad(name,mat,pt(a,i),pt(a,i+1),pt(b,i+1),pt(b,i))

def polar(center,r,t,dy=0):
    x,y,z=center
    return (x+r*math.cos(t),y+dy,z+r*math.sin(t))

def ring(name,mat,center,inside,outside,lo,hi,start=0,end=TAU,segments=64):
    for i in range(segments):
        a=start+(end-start)*i/segments;b=start+(end-start)*(i+1)/segments
        p=polar(center,inside,a,hi);q=polar(center,inside,b,hi)
        t=polar(center,outside,b,hi);s=polar(center,outside,a,hi)
        quad(name,mat,p,q,t,s)
        quad(name,mat,s,t,polar(center,outside,b,lo),polar(center,outside,a,lo))
        if inside:quad(name,mat,q,p,polar(center,inside,a,lo),polar(center,inside,b,lo))

# Coordinates follow the reference image viewed from the entrance toward the roof deck.
zones={
 'entry':('입구',(0,0,19),2.65,'travertine'),
 'main':('메인 라운지',(0,0,1),6.9,'limestone'),
 'garden':('가든 라운지',(-12,.65,-3),4.35,'sage'),
 'vip':('VIP 테라스',(-10,1.4,10),3.95,'timber'),
 'cafe':('카페 라운지',(10,0,10),3.95,'travertine'),
 'booths':('프라이빗 부스',(14,.95,-3),4.2,'timber'),
 'roof':('루프탑 테라스',(0,3.1,-14),5.2,'plank')
}
links=[('entry','main'),('main','garden'),('main','cafe'),('main','booths'),
       ('garden','vip'),('vip','entry'),('cafe','entry'),('booths','cafe'),
       ('garden','roof'),('roof','booths')]
gates=defaultdict(list); bridges={}; passages={}
for a,b in links:
    _,p,r,_=zones[a];_,q,s,_=zones[b]
    dx,dz=q[0]-p[0],q[2]-p[2];length=math.hypot(dx,dz);dx/=length;dz/=length
    # Bridge ends overlap the circular paving slightly. The slope begins at the deck seam.
    start=(p[0]+dx*(r-.06),p[1],p[2]+dz*(r-.06))
    end=(q[0]-dx*(s-.06),q[1],q[2]-dz*(s-.06))
    bridges[a,b]=[start,end];bridges[b,a]=[end,start]
    passages[a+'-'+b]=[start,end]
    width=3.2 if a=='entry' and b=='main' else 2.5
    for key,angle,radius in [(a,math.atan2(dz,dx),r),(b,math.atan2(-dz,-dx),s)]:
        gates[key].append((angle,math.asin(min(.95,(width/2+.35)/radius))))
    def shift(pt,side,dy=0):return (pt[0]-dz*side,pt[1]+dy,pt[2]+dx*side)
    h=width/2; name='floor/path '+a+' '+b
    quad(name,'plank',shift(start,-h),shift(start,h),shift(end,h),shift(end,-h))
    steps=math.ceil(math.dist(start,end)/.38)
    for i in range(1,steps):
        t=i/steps;mid=tuple(x+(y-x)*t for x,y in zip(start,end))
        beam('trim/board joints','timber',shift(mid,-h,.004),shift(mid,h,.004),.012,4)
    for side in [-h,h]:
        l=shift(start,side);rpt=shift(end,side)
        quad('trim/bridge fascia','bronze',l,rpt,shift(end,side,-.24),shift(start,side,-.24))
        if max(start[1],end[1])>.5:
            beam('wall/path rails','bronze',shift(start,side,.84),shift(end,side,.84),.047)
            for i in range(5):
                t=i/4;foot=tuple(x+(y-x)*t for x,y in zip(l,rpt))
                beam('wall/path posts','bronze',foot,(foot[0],foot[1]+.84,foot[2]),.038)

def open_edge(key,t):
    return any(abs(math.atan2(math.sin(t-a),math.cos(t-a)))<gap for a,gap in gates[key])

seats={}; rng=random.Random(21)
for key,(label,c,r,material) in zones.items():
    ring('floor/'+key,material,c,0,r,-.4,0)
    ring('trim/edge inlay','cream',c,r-.32,r-.19,.002,.014)
    ring('trim/deck plinth','clay',c,r-.12,r,-1.55,-.4)
    seats[key]=[]
    for i in range(64):
        a=TAU*i/64;b=TAU*(i+1)/64
        if open_edge(key,(a+b)/2):continue
        ring('wall/parapets','limestone',c,r-.18,r,0,.42,a,b,1)
        ring('trim/parapet caps','cream',c,r-.23,r+.02,.42,.49,a,b,1)
        if key!='entry' and i%8==0:seats[key].append(polar(c,r-1.15,(a+b)/2))
        if key in ('garden','roof','vip','booths','cafe') and i%3==0:
            shrub=polar(c,r-.55,a)
            ring('wall/planting','clay',shrub,0,.38,0,.25,segments=10)
            ring('wall/foliage','moss' if i%2 else 'leaf',shrub,0,.43,.25,.60+rng.random()*.24,segments=9)
        if key in ('booths','cafe','vip') and 0<=i<19:
            if i%4==0:beam('wall/pergola posts','bronze',polar(c,r-.36,a),polar(c,r-.36,a,2.55),.066)
            ring('trim/pergola','cream',c,r-1.35,r-.24,2.48,2.58,a,b,1)
    if key=='main':
        for radius in (2.5,4.6):ring('trim/paving bands','cream',c,radius,radius+.08,.002,.012)
seats.pop('entry')
# One fixed flowering canopy is the orientation landmark, with circulation around its planter.
c=zones['main'][1]
ring('wall/tree planter','clay',c,0,1.45,0,.40)
ring('trim/tree coping','cream',c,1.32,1.5,.40,.48)
beam('wall/trunk','timber',c,(.15,3.7,1),.22)
for i in range(15):
    t=i*2.4;dist=.55+1.5*(i%5)/4
    crown=polar(c,dist,t,3.15+.95*rng.random())
    beam('trim/branches','timber',(0,2.05,1),crown,.095)
    # Faceted crowns rise and taper instead of covering the entire walking ring.
    rad=.65+.46*rng.random()
    for j in range(9):
        a=j*TAU/9;b=(j+1)*TAU/9
        lo=polar(crown,0,0,-.58);top=polar(crown,0,0,.82)
        p=polar(crown,rad,a);q=polar(crown,rad,b)
        triangle('trim/blossoms','rose',lo,p,q);triangle('trim/blossoms','petal',top,q,p)

anchors={label:list(c) for label,c,_,_ in zones.values()}
anchors['메인 라운지']=[0,0,4.4]
# Walk the west and east branches, then the roof-to-booths connection.
route=[zones['entry'][1]]
def cross(a,b):
    route.extend(bridges[a,b]);route.append(zones[b][1] if b!='main' else tuple(anchors['메인 라운지']))
cross('entry','main')
route.append((-3.4,0,3.4));cross('main','garden');cross('garden','vip');cross('vip','entry')
cross('entry','cafe');cross('cafe','main');route.append((3.8,0,2.4));cross('main','booths')
cross('booths','roof');cross('roof','garden');cross('garden','roof');cross('roof','booths')
cross('booths','cafe');cross('cafe','entry')
extras=dict(version='05d-3.v1',unit='metre',anchors=anchors,reviewRoute=route,
            zones={k:dict(center=c,radius=r) for k,(_,c,r,_) in zones.items()},
            gateways=passages,seatCandidates=seats)
buf=bytearray(); views=[]; access=[]; meshes=[]; nodes=[]
def attribute(data):
    offset=len(buf)
    for xyz in data:buf.extend(struct.pack('<3f',*xyz))
    views.append(dict(buffer=0,byteOffset=offset,byteLength=len(buf)-offset,target=34962))
    access.append(dict(bufferView=len(views)-1,componentType=5126,count=len(data),type='VEC3',
                       min=list(map(min,zip(*data))),max=list(map(max,zip(*data)))))
    return len(access)-1
for (name,color),(positions,normals) in parts.items():
    primitive=dict(attributes=dict(POSITION=attribute(positions),NORMAL=attribute(normals)),material=list(palette).index(color))
    nodes.append(dict(name=name,mesh=len(meshes)));meshes.append(dict(name=name,primitives=[primitive]))
materials=[dict(name=k,pbrMetallicRoughness=dict(baseColorFactor=[*v,1],metallicFactor=.06,roughnessFactor=.85)) for k,v in palette.items()]
doc=dict(asset=dict(version='2.0'),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,
         meshes=meshes,materials=materials,buffers=[dict(byteLength=len(buf))],bufferViews=views,accessors=access,extras=extras)
data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
(ROOT/'social-empty.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(buf))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(buf),b'BIN\0')+buf)
