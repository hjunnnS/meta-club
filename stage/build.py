"""Build the 05a-1 metre-scale glTF and its standalone review copy."""
import base64
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
VERSION = "05a-1.v1"
materials = []
parts = {}
walkable = []

def material(name, color):
    materials.append(dict(name=name, pbrMetallicRoughness=dict(baseColorFactor=[*color, 1], metallicFactor=0, roughnessFactor=.83)))
    return len(materials)-1

floor = material("Arena · basalt", (.073,.108,.147))
metal = material("Structural graphite", (.042,.060,.081))
rim = material("Brushed steel", (.27,.35,.39))
teal = material("Route inlay · mineral blue", (.15,.62,.65))
amber = material("Balcony inlay · ochre", (.88,.45,.14))
deck = material("Stage surface", (.15,.21,.26))
wall = material("Perimeter panels", (.107,.15,.19))
def tri(group, mat, a,b,c, surface=False):
    u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
    n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    length=math.sqrt(sum(i*i for i in n))
    if length<1e-8: return
    positions,normals=parts.setdefault((group,mat),([],[]))
    positions.extend([a,b,c]);normals.extend([[i/length for i in n]]*3)
    if surface: walkable.append((a,b,c))

def slab(group, mat, outline, bottom, surface=False):
    # Outline runs counterclockwise in XZ as seen from above (+Y).
    base=[(x,bottom,z) for x,y,z in outline]
    for i in range(1,len(outline)-1):
        tri(group,mat,outline[0],outline[i],outline[i+1],surface)
        tri(group,mat,base[0],base[i+1],base[i])
    for i,a in enumerate(outline):
        j=(i+1)%len(outline)
        tri(group,mat,a,base[i],base[j])
        tri(group,mat,a,base[j],outline[j])

def rect(group,mat,x1,x2,z1,z2,y1,y2,bottom,surface=False):
    slab(group,mat,[(x1,y1,z1),(x1,y2,z2),(x2,y2,z2),(x2,y1,z1)],bottom,surface)

def box(group,mat,x1,x2,z1,z2,bottom,top,surface=False):
    rect(group,mat,x1,x2,z1,z2,top,top,bottom,surface)

def polar(r,t,y):
    return (r*math.cos(t),y,-r*math.sin(t))

def ring(group,mat,inner,outer,t1,t2,lo,hi,n,surface=False):
    for i in range(n):
        a=t1+(t2-t1)*i/n;b=t1+(t2-t1)*(i+1)/n
        slab(group,mat,[polar(inner,a,hi),polar(outer,a,hi),polar(outer,b,hi),polar(inner,b,hi)],lo,surface)

P=math.pi
slab("Arena floor",floor,[polar(21,i*2*P/96,0) for i in range(96)],-.4,True)
# South portal leaves a clear approach from the entry gallery.
ring("Arena shell",wall,20.85,21.15,-P/2+.175,1.5*P-.175,-.4,6.1,88)
ring("Upper coping",rim,20.65,21.25,-P/2+.175,1.5*P-.175,6.1,6.26,88)
for i in range(32):
    t=2*P*i/32
    if abs(math.sin(t)+1)<.02:continue
    ring("Shell ribs",metal,20.44,20.84,t-.009,t+.009,0,6.3,1)
for x in [-3.65,3.35]:
    box("Entry gallery",wall,x,x+.30,20.4,28.8,-.3,4.35)
for z in [21.4,24.7,28.0]:
    box("Portal frames",metal,-3.66,3.66,z,z+.26,4.14,4.55)
    for x in [-3.35,3.13]:box("Portal frames",rim,x,x+.22,z,z+.26,0,4.14)
box("Entry floor",floor,-3.65,3.65,19.9,29,-.4,0,True)
for x in [-2.92,2.84]:
    box("Entry guide",teal,x,x+.08,10,28.8,.001,.012)
ring("Floor band",rim,8.8,8.86,0,2*P,.001,.012,96)
ring("Floor band",rim,16.5,16.56,0,2*P,.001,.012,96)
slab("Central stage",deck,[polar(4.9,i*2*P/64,.8) for i in range(64)],0,True)
ring("Stage edge",teal,4.84,4.91,0,2*P,.79,.814,64)
rect("Stage access",deck,-1.7,1.7,4.52,9.5,.8,0,-.04,True)
# Two sloped curbs and stripes identify the right-hand balcony approach.
rect("Balcony ramp",deck,11.3,14.7,0,15,4,0,-.06,True)
for x in [11.3,14.54]:
    rect("Ramp curb",rim,x,x+.16,0,15,4.16,.16,0)
    rect("Ramp rail",amber,x,x+.09,0,15,5.03,1.03,0)
ring("North balcony",deck,10.75,17.0,0,P,3.68,4,64,True)
for r in [10.75,16.86]:
    ring("Balcony rail",metal,r,r+.12,0,P,4,4.95,64)
    ring("Rail cap",amber,r-.025,r+.145,0,P,4.95,5,64)
for t in [.18,.52,.86,1.2,1.55,1.9,2.24,2.58,2.92]:
    x,_,z=polar(15,t,0)
    box("Balcony columns",metal,x-.23,x+.23,z-.23,z+.23,0,3.68)
# Stop rails at the balcony ends, leaving the eastern ramp opening clear.
for a,b in [(10.75,11.3),(14.7,17),(-17,-10.75)]:
    box("End rail",metal,a,b,-.12,0,4,5)
# Camera path carries ground elevation. View targets are independent of travel direction.
route=[(0,0,27),(0,0,19),(0,0,9.5),(0,.8,4.52),(0,.8,0),
       (0,.8,4.52),(0,0,9.5),(5,0,13),(11,0,15.5),(13,0,15.5),
       (13,0,15),(13,4,0)]+[polar(13,i*P/32,4) for i in range(1,17)]
def ground(x,z):
    top=-999
    for (ax,ay,az),(bx,by,bz),(cx,cy,cz) in walkable:
        det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
        if abs(det)<1e-10:continue
        u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det
        v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det
        if min(u,v,1-u-v)>=-1e-6:top=max(top,u*ay+v*by+(1-u-v)*cy)
    return top
# Disk and access ramp overlap at the lip. Allow its small transition at z=4.9.
for a,b in zip(route,route[1:]):
    for j in range(101):
        x,y,z=[a[i]+(b[i]-a[i])*j/100 for i in range(3)]
        assert abs(ground(x,z)-y)<.07,(x,y,z,ground(x,z))
buf=bytearray();views=[];access=[];meshes=[];nodes=[]
def attr(points):
    offset=len(buf)
    for xyz in points:buf.extend(struct.pack('<3f',*xyz))
    views.append(dict(buffer=0,byteOffset=offset,byteLength=len(buf)-offset,target=34962))
    access.append(dict(bufferView=len(views)-1,componentType=5126,count=len(points),type="VEC3",
                       min=list(map(min,zip(*points))),max=list(map(max,zip(*points)))))
    return len(access)-1
for group in dict.fromkeys(g for g,m in parts):
    primitives=[]
    for (g,m),(pos,norm) in parts.items():
        if g==group: primitives.append(dict(attributes=dict(POSITION=attr(pos),NORMAL=attr(norm)),material=m))
    meshes.append(dict(name=group,primitives=primitives));nodes.append(dict(name=group,mesh=len(meshes)-1))
doc=dict(asset=dict(version="2.0",generator="meta-club "+VERSION),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(buf))],bufferViews=views,accessors=access,extras=dict(version=VERSION,unit="metre",reviewRoute=route,eyeHeight=1.65,stageIndex=4))
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(js)+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf
(ROOT/'edm-empty.glb').write_bytes(glb)
(ROOT/'review.html').write_text((ROOT/'review.template').read_text().replace('__GLB__',base64.b64encode(glb).decode()))
print(VERSION,len(glb),'bytes;',len(route),'waypoints; route support verified')
