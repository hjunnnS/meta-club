"""Generate the metre-scale hip-hop alley blockout, with inspection anchors in glTF extras."""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).parent
palette = {
    'asphalt': (.095,.10,.12), 'cement': (.32,.30,.28), 'brick': (.34,.13,.075),
    'iron': (.07,.085,.105), 'shutter': (.20,.24,.25), 'amber': (.96,.48,.075),
    'blue': (.12,.39,.46), 'ochre': (.55,.31,.12), 'ivory': (.70,.62,.45),
}
parts = {}
def slab(name, color, x0,x1,z0,z1, bottom, front, back=None):
    if back is None: back=front
    pts=[(x0,front,z0),(x0,back,z1),(x1,back,z1),(x1,front,z0),
         (x0,bottom,z0),(x0,bottom,z1),(x1,bottom,z1),(x1,bottom,z0)]
    vertices,normals=parts.setdefault((name,color),([],[]))
    for a,b,c,d in [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]:
        u=[pts[b][k]-pts[a][k] for k in range(3)]
        v=[pts[c][k]-pts[a][k] for k in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        length=sum(i*i for i in n)**.5
        if length:
            for i in [a,b,c,a,c,d]:
                vertices.append(pts[i]); normals.append([j/length for j in n])

# Non-overlapping floors. The front and rear crossings join the two north/south alleys.
floors=[
 ('entry','cement',-3,3,14,21), ('forecourt','cement',-9,9,10,14),
 ('hall','asphalt',-5,5,-8,10), ('west-alley','cement',-9,-5,-8,10),
 ('east-alley','cement',5,9,-8,10), ('backstreet','asphalt',-5,9,-13,-8),
 ('bar','brick',-16,-9,7,14), ('street','ochre',-16,-9,-7,4),
 ('crew','blue',9,16,6,14), ('battle','ochre',9,16,-13,-2)]
for name,color,*bounds in floors: slab('floor/'+name,color,*bounds,-.35,0)
slab('floor/ramp','cement',-9,-5,-18,-8,-.35,3.5,0)
slab('floor/landing','cement',-9,-5,-21,-18,3.2,3.5)
slab('floor/roof','cement',-17,-9,-21,-14,3.15,3.5)

def wall(name,x0,x1,z0,z1,height,base=0,color='brick'):
    slab('wall/'+name,color,x0,x1,z0,z1,base,height)
# Street frontage: gaps at each entrance remain open.
for side in [-1,1]:
    def strip(group,x0,x1,z0,z1,lo,hi,color):
        a,b=sorted([side*x0,side*x1]);slab(group,color,a,b,z0,z1,lo,hi)
    for i,(lo,hi) in enumerate([(-7.5,-5),(-2,1),(4.3,7),(10,12.7)]):
        strip('wall/shopfront',8.75,9,lo,hi,0,2.8,'brick')
        strip('trim/awning',8.40,9.1,lo,hi,2.57,2.72,'amber' if i%2 else 'blue')
        strip('trim/shutter',8.72,8.75,lo+.12,hi-.12,.12,2.2,'shutter')
        for band in range(5):
            strip('trim/shutter ribs',8.68,8.72,lo+.12,hi-.12,.42+band*.34,.46+band*.34,'iron')
    for z in [-5.2,5.3]:
        strip('wall/hall pier',4.9,5.25,z,z+.55,0,4.1,'iron')
    strip('trim/hall lintel',4.9,5.25,-5.2,5.85,3.85,4.1,'ochre')
for name,x0,x1,z0,z1,height in [
 ('west exterior',-16,-15.7,-7,14,3.6),('east exterior',15.7,16,-13,14,4),
 ('battle back',9,16,-13,-12.7,4.8),('rear elevation',-5,9,-13,-12.7,5.3),
 ('roof back',-17,-5,-21,-20.8,4.45),('roof west',-17,-16.8,-21,-14,4.45),
 ('roof parapet',-17,-9,-14.2,-14,4.25),('lobby left',-3,-2.8,14,20,1.3),
 ('lobby right',2.8,3,14,20,1.3)]:
    wall(name,x0,x1,z0,z1,height,3.5 if name.startswith('roof') else 0)
# Raised warehouse facade, rooftop edges and painted threshold marks.
wall('warehouse',-17,-9.1,-21,-14,3.15,color='brick')
for x in [-8.98,-5.14]:
    slab('wall/ramp kerb','iron',x,x+.12,-18,-8,-.1,3.83,.33)
for x in [-3,0,3,6]:
    slab('trim/rear windows','shutter',x,x+1.7,-12.7,-12.63,2.65,4.45)
    slab('trim/rear window mullions','iron',x+.79,x+.87,-12.63,-12.60,2.65,4.45)
for x in [-4.4,4.28]:
    slab('paint/hall','ivory',x,x+.12,-6.3,7.6,0,.009)
for z in [-6.3,7.5]:
    slab('paint/hall','ivory',-4.4,4.4,z,z+.10,0,.009)
# Infill buildings separate the rooms, making the two crossing alleys readable at eye level.
for name,x0,x1,z0,z1,height in [
    ('west row',-16,-9,4,7,3.65),('east row',9,16,-2,6,4.1),
    ('warehouse annex',-16,-9,-14,-7,3.05)]:
    wall(name,x0,x1,z0,z1,height)
    slab('trim/roof coping','iron',x0-.08,x1+.08,z0-.08,z1+.08,height,height+.12)
    slab('trim/roof service box','shutter',x0+1,x0+2.5,z0+.8,z0+1.7,height+.12,height+.55)
    face=x1 if x1<0 else x0
    sign=1 if x1<0 else -1
    a,b=sorted([face,face+sign*.035])
    for i in range(int(z1-z0)):
        slab('trim/clerestory','blue',a,b,z0+i+.16,z0+i+.84,2.1,2.75)
# Low ledges and back walls frame the pockets without blocking the shopfront openings.
for name,x0,x1,z,height in [
    ('west bar',-16,-9,14,2.0),('crew',9,16,14,2.0),
    ('battle',9,16,-2.1,2.4),('street',-16,-9,-7,2.4)]:
    wall(name,x0,x1,z-.15,z,height)
    slab('trim/lintel','iron',x0,x1,z-.19,z+.03,height,height+.1)
# Candidate positions only. No activity, photo triggers, NPCs or goods.
anchors={'입구':[0,0,18],'메인 홀':[0,0,1],'바 구역':[-12,0,10],
         '스트리트 라운지':[-12,0,-3],'배틀존':[12,0,-8],'크루 라운지':[12,0,10],
         '루프탑':[-13,3.5,-17]}
route=[[0,0,18],[0,0,12],[-7,0,12],[-7,0,9],[-12,0,9],[-7,0,9],[-7,0,3],
       [-12,0,3],[-12,0,-3],[-7,0,-3],[-7,0,-8],[-7,3.5,-18],[-7,3.5,-19],
       [-13,3.5,-19],[-13,3.5,-17],[-13,3.5,-19],[-7,3.5,-19],[-7,3.5,-18],
       [-7,0,-8],[-7,0,-4],[0,0,-4],[0,0,1],[0,0,-10],[7,0,-10],[12,0,-10],
       [12,0,-8],[7,0,-8],[7,0,9],[12,0,9],[7,0,9],[7,0,12],[0,0,12],[0,0,18]]
extras=dict(version='05d-2.v1',unit='metre',anchors=anchors,reviewRoute=route,
            placements={'streetDance':anchors['메인 홀'],'battleDance':anchors['배틀존'],'photo':[-13,3.5,-16]},
            gateways={'street':[-9,0,-3],'battle':[9,0,-8],'crew':[9,0,9],'roof':[-9,3.5,-19]})
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
(ROOT/'hiphop-empty.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(buf))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(buf),b'BIN\0')+buf)
