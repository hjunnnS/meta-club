"""Generate the 05d-4 retro disco architectural blockout and review coordinates."""
import json
import math
import struct
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
parts = defaultdict(lambda: ([], []))
colors = {
    'aubergine': (.105,.035,.09), 'velvet': (.29,.045,.13), 'wine': (.39,.075,.15),
    'brass': (.73,.43,.16), 'cream': (.95,.74,.43), 'plum': (.30,.13,.32),
    'coral': (.79,.24,.27), 'rose': (.85,.31,.49), 'orchid': (.57,.28,.64),
    'honey': (.94,.61,.24), 'peach': (.98,.55,.38), 'deep': (.15,.10,.19),
}

def face(name, mat, a, b, c):
    u=[j-i for i,j in zip(a,b)];v=[j-i for i,j in zip(a,c)]
    n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    length=math.hypot(*n)
    if not length:return
    pos,norm=parts[name,mat]
    pos.extend((a,b,c));norm.extend([tuple(i/length for i in n)]*3)

def quad(name,mat,a,b,c,d):
    face(name,mat,a,b,c);face(name,mat,a,c,d)

def box(name,mat,x0,x1,z0,z1,lo,hi):
    p=[(x0,hi,z0),(x0,hi,z1),(x1,hi,z1),(x1,hi,z0),
       (x0,lo,z0),(x0,lo,z1),(x1,lo,z1),(x1,lo,z0)]
    for ids in [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]:
        quad(name,mat,*(p[i] for i in ids))

# All seven spaces share one walking elevation. Threshold slabs bridge each future zone seam.
zones={'entry':(-3,3,12,18),'hall':(-7,7,-12,12),'stage':(-7,7,-16,-12),
       'A':(-16,-8,-11,4),'B':(8,16,-11,4),'lounge':(-16,-8,5,12),'bar':(8,16,5,12)}
for zone,bounds in zones.items():
    box('floor/'+zone,'deep' if zone in ('hall','A','B') else 'wine',*bounds,-.36,0)
gates={}
def link(name,bounds):
    box('floor/link '+name,'brass',*bounds,-.36,0)
    x0,x1,z0,z1=bounds
    gates[name]={'bounds':bounds,'center':[(x0+x1)/2,0,(z0+z1)/2]}
for label,lo,hi in [('A',-8,-7),('B',7,8)]:
    for suffix,z0,z1 in [('main',-6,-2),('front',.5,3.5),('lobby',7,10)]:
        link(label+' '+suffix,(lo,hi,z0,z1))
    x=-12 if label=='A' else 12
    link(label+' return',(x-1.5,x+1.5,4,5))
# Static tile pattern: clear horizontal approaches to both main doorways.
tile_colors=['rose','honey','orchid','peach','coral']
for area,cx,cz,nx,nz,pitch in [('hall',0,-.2,8,12,1.48),('A',-12,-3.4,6,9,1.07),('B',12,-3.4,6,9,1.07)]:
    for ix in range(nx):
        for iz in range(nz):
            x=cx+(ix-nx/2)*pitch;z=cz+(iz-nz/2)*pitch
            accent=tile_colors[(ix*3+iz*2+(ix//2)*(iz//3))%5]
            if area=='A':accent=['plum','orchid','rose'][(ix+iz)%3]
            if area=='B':accent=['wine','coral','honey'][(ix+2*iz)%3]
            quad('trim/tile '+area,accent,(x+.045,.008,z+.045),(x+.045,.008,z+pitch-.045),
                 (x+pitch-.045,.008,z+pitch-.045),(x+pitch-.045,.008,z+.045))

def wall(name,x0,x1,z0,z1,h,mat='velvet'):
    box('wall/'+name,mat,x0,x1,z0,z1,0,h)
    box('trim/coping','brass',x0-.012,x1+.012,z0-.012,z1+.012,h,h+.065)
for side in [-1,1]:
    def span(a,b):return sorted((a*side,b*side))
    wall('outer flank',*span(15.8,16),-11,12,1.6)
    wall('back wing',*span(8,16),-11,-10.76,3.3)
    wall('front wing',*span(8,16),11.8,12,1.05)
    for a,b in [(-12,-6),(-2,.5),(3.5,7),(10,12)]:
        wall('partition',*span(6.92,7.15),a,b,1.15)
    for x0,x1 in [(8,10.5),(13.5,16)]:
        wall('wing threshold',*span(x0,x1),3.87,4,1.1)
    for z0,z1 in [(-6,-2),(.5,3.5),(7,10)]:
        for z in [z0-.12,z1+.12]:
            box('wall/portal jamb','brass',*span(7.05,7.66),z-.11,z+.11,0,2.95)
        box('trim/portal lintel','cream',*span(7.05,7.66),z0-.22,z1+.22,2.84,3.00)
    wall('entry return',*span(3.03,7),11.82,12,1)
    wall('entry rail',*span(2.88,3),12,17.9,.82)
    # Fluted back panels and brass accents read as architecture even with the halls empty.
    for i in range(12):
        x=8.35+i*.65
        box('trim/wing flutes','brass',*span(x,x+.055),-10.76,-10.68,.35,2.7-.6*math.cos(i*.55))
wall('stage backdrop',-7,7,-16,-15.75,4.6,'aubergine')
for side in [-1,1]:
    for i in range(5):
        x=side*(3.1+i*.73)
        box('wall/backdrop steps','wine',x-.33,x+.33,-15.75,-15.35,0,4.1-i*.37)
        box('trim/backdrop tips','brass',x-.30,x+.30,-15.35,-15.31,3.89-i*.37,4.1-i*.37)
# Concentric brass arches on the back wall. The suspended mirror-ball position is metadata only.
for radius in [1.55,1.82,2.12,2.45,2.8]:
    for i in range(36):
        def point(r,j):return (r*math.cos(math.pi*j/36),.6+r*math.sin(math.pi*j/36),-15.68)
        quad('trim/stage fan','brass',point(radius,i),point(radius+.065,i),point(radius+.065,i+1),point(radius,i+1))
for z in [-12,-11.78]:
    box('trim/stage threshold','brass',-6.7,6.7,z,z+.065,0,.012)

anchors={'입구':[0,0,16],'메인 디스코홀':[0,0,1],'DJ 스테이지':[0,0,-14],
         '보조 홀 A':[-12,0,-4],'보조 홀 B':[12,0,-4],'레트로 라운지':[-12,0,8.5],'바 구역':[12,0,8.5]}
waypoints=[(0,16),(0,9),(0,1),(0,-14),(0,-4),(-12,-4),(-14,-4),(0,-4),(14,-4),(12,-4),
           (12,1.9),(0,1.9),(-12,1.9),(-12,8.5),(0,8.5),(12,8.5),(12,1.9),(0,1.9),(0,16)]
extras=dict(version='05d-4.v1',unit='metre',zones=zones,gateways=gates,anchors=anchors,
            reviewRoute=[[x,0,z] for x,z in waypoints], sightline=[[-14,1.65,-4],[14,1.65,-4]],
            placements={'mainDance':[0,0,0],'danceA':[-12,0,-4],'danceB':[12,0,-4],'mirrorBall':[0,5.2,0]})
buf=bytearray(); views=[]; access=[]; meshes=[]; nodes=[]
def attribute(data):
    offset=len(buf)
    for xyz in data:buf.extend(struct.pack('<3f',*xyz))
    views.append(dict(buffer=0,byteOffset=offset,byteLength=len(buf)-offset,target=34962))
    access.append(dict(bufferView=len(views)-1,componentType=5126,count=len(data),type='VEC3',
                       min=list(map(min,zip(*data))),max=list(map(max,zip(*data)))))
    return len(access)-1
for (name,color),(positions,normals) in parts.items():
    primitive=dict(attributes=dict(POSITION=attribute(positions),NORMAL=attribute(normals)),material=list(colors).index(color))
    nodes.append(dict(name=name,mesh=len(meshes)));meshes.append(dict(name=name,primitives=[primitive]))
materials=[dict(name=k,pbrMetallicRoughness=dict(baseColorFactor=[*v,1],metallicFactor=.06,roughnessFactor=.85)) for k,v in colors.items()]
doc=dict(asset=dict(version='2.0'),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,
         meshes=meshes,materials=materials,buffers=[dict(byteLength=len(buf))],bufferViews=views,accessors=access,extras=extras)
data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
(ROOT/'retro-empty.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(buf))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(buf),b'BIN\0')+buf)
