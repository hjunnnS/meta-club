"""Build the 05a-1 metre-scale glTF and its standalone review copy."""
import base64
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parent
festival = "--festival" in sys.argv
VERSION = "05a-2.v3"
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

P = math.pi
violet = material("Ultraviolet guide", (.54, .08, .98))
ice = material("Glacier guide", (.03, .75, 1.0))
pink = material("Fuchsia guide", (1.0, .10, .54))
indigo = material("Dance floor · indigo", (.07,.065,.17))
for index in (violet, ice, pink):
    materials[index]["emissiveFactor"] = [v*.5 for v in materials[index]["pbrMetallicRoughness"]["baseColorFactor"][:3]]

def octagon(name, mat, x, z, width, depth, cut, bottom, top, surface=False):
    a,b=width/2,depth/2
    outline=[(-a,-b+cut),(-a,b-cut),(-a+cut,b),(a-cut,b),(a,b-cut),(a,-b+cut),(a-cut,-b),(-a+cut,-b)]
    slab(name,mat,[(x+dx,top,z+dz) for dx,dz in outline],bottom,surface)

def beam(name,mat,a,b,radius):
    delta=[v-u for u,v in zip(a,b)]
    length=math.sqrt(sum(v*v for v in delta))
    unit=[v/length for v in delta]
    def cross(u,v):
        return (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    n=cross(unit,(0,1,0) if abs(unit[1])<.9 else (1,0,0))
    norm=math.sqrt(sum(v*v for v in n))
    n=[v/norm for v in n]; m=cross(unit,n)
    def circle(p):
        return [tuple(v+radius*(n[k]*math.cos(j*P/4)+m[k]*math.sin(j*P/4)) for k,v in enumerate(p)) for j in range(8)]
    low,high=circle(a),circle(b)
    for i in range(8):
        j=(i+1)%8
        tri(name,mat,low[i],low[j],high[j]);tri(name,mat,low[i],high[j],high[i])
        tri(name,mat,a,low[j],low[i]);tri(name,mat,b,high[i],high[j])

# Cutaway envelope: open front and low side walls preserve the reference sightline.
octagon("Arena floor",floor,0,0,45,43,4,-.65,0,True)
box("Rear wall",wall,-19,19,-21.5,-21.15,0,6)
for side in [-1,1]:
    x=side*22.2
    box("Side wall",metal,x-.18,x+.18,-16,16,0,1.05)
    box("Side wall coping",violet,x-.2,x+.2,-16,16,1.05,1.12)
box("Entry floor",deck,-4,4,20.5,27,-.64,0,True)
for x in [-3.85,3.85]:
    box("Entry parapet",metal,x-.14,x+.14,19,26.9,.01,.68)
    box("Entry guide",ice,x-.18,x+.18,19,26.9,.68,.74)
for z in (22.0,23,24,25,26):
    box("Entry threshold",ice,-3.45,3.45,z,z+.09,.002,.012)

# Audience circle remains at grade. The performer platform is at the north end.
slab("Dance floor",indigo,[polar(8.5,i*2*P/96,.018) for i in range(96)],.002,True)
for r,mat,w in [(8.29,violet,.17),(8.53,ice,.055),(9.1,rim,.045)]:
    ring("Dance floor perimeter",mat,r,r+w,0,2*P,.018,.034,96)
for i in range(48):
    angle=i*2*P/48
    ring("Floor markers",violet if i%4==0 else rim,8.63,8.89,angle-.007,angle+.007,.002,.014,1)
# Short lines in the floor lead towards the main stage.
for x in (-3.0,3.0):
    box("Processional lane",ice,x-.06,x+.06,8.7,20.7,.003,.021)

octagon("DJ platform",deck,0,-14.2,15,8.4,1.15,-.03,1.35,True)
rect("DJ access",deck,-2.0,2.0,-10.05,-7.6,1.35,0,-.01,True)
for x1,x2 in [(-6.25,-2.2),(2.2,6.25)]:
    box("Stage lip",pink,x1,x2,-10.13,-10.02,1.18,1.31)
booth_z = -15.6 if festival else -15.75
octagon("DJ booth",metal,0,booth_z,6.9,1.65,.45,1.35,2.45)
box("Booth trim",ice,-3,3,booth_z+.81,booth_z+.85,2.32,2.43)
box("Stage backdrop",indigo,-6.8,6.8,-18.8,-18.45,1.35,8.0)
for side in (-1,1):
    # Architectural fan frames, visible from the entry above the booth.
    for j,(reach,height) in enumerate([(2.3,7.7),(4.7,7.25),(6.3,6.25)]):
        beam("Stage fan", (pink,violet,ice)[j],(side*.28,2.48,-18.24),(side*reach,height,-18.24),.13)
    for x,h in [(7.7,6.7),(9.1,5.65)]:
        beam("Stage pylons",metal,(side*x,0,-15),(side*(x+.65),h,-17),.35)
        beam("Pylon trim",violet,(side*x,1.1,-14.65),(side*(x+.65),h,-16.65),.09)

for side, label in [(-1,"West"),(1,"East")]:
    # The festival east side is an open floor, without the old raised dance pad.
    if festival and side > 0:
        continue
    x=side*14.6
    # Keep the festival stair approach on the plain arena floor, without the old side pad.
    if not festival:
        octagon(label+" dance zone",deck,x,6,10.2,11,1.6,0,.045,True)
        for dz in [-3.65,-1.85,0,1.85,3.65]:
            box(label+" floor pattern",indigo,x-3.75,x+3.75,6+dz-.8,6+dz+.8,.046,.055)
        # Distinct edges along the outside, leaving the centre-side entrance clear.
        for z in [1.7,10.3]:
            box(label+" threshold",violet,x-3.65,x+3.65,z,z+.13,.055,.07)
        box(label+" zone edge",violet,x+side*4.65-.08,x+side*4.65+.08,2.6,9.4,.05,.09)
    if festival:
        rect('West deck ramp',deck,-18.55,-17.25,2,10,4,.045,-.01,True)
        for edge in [-18.5,-17.3]:
            beam('West ramp rail',violet,(edge,1,10),(edge,5,2),.045)
            for i in range(5):
                z=10-i*2;box('West ramp posts',metal,edge-.04,edge+.04,z-.04,z+.04,i,i+.95)
        continue
    # EDM: move the west ramp into the reclaimed speaker footprint and extend the lounge forwards.
    ramp_x=-17.9 if festival else x
    top_z,bottom_z=(2,10) if festival else (-8,0)
    rect(label+" deck ramp",deck,ramp_x-1.55,ramp_x+1.55,top_z,bottom_z,4,.045 if festival else 0,-.01,True)
    for edge in [ramp_x-1.5,ramp_x+1.5]:
        beam(label+" ramp rail",violet,(edge,1,bottom_z),(edge,5,top_z),.055)
        for i in range(5):
            z=bottom_z-2*i;y=i+.04
            box(label+" ramp posts",metal,edge-.055,edge+.055,z-.055,z+.055,y,y+.95)
    centre_z,depth,corner=-13.8,11.8,.8
    octagon(label+" upper deck",deck,x,centre_z,10.8,depth,corner,3.64,4,True)
    inner=x-side*5.32;outer=x+side*5.32
    front=-8.75
    for edge in (inner,outer):
        beam(label+" deck handrail",ice,(edge,5,-18.9),(edge,5,front),.06)
        for z in [-18.9,-16.5,-14.2,-11.8,-8.75]:
            box(label+" posts",metal,edge-.06,edge+.06,z-.06,z+.06,4,5)
    for xc in [x-4,x+4]:
        for z in [-17.4,-9.4]:
            box(label+" supports",metal,xc-.21,xc+.21,z-.21,z+.21,0,3.64)
    front_left,front_right=(x-5.0,x+5.0) if festival else (x-4.5,x+4.5)
    for lo,hi in [(front_left,ramp_x-1.65),(ramp_x+1.65,front_right)]:
        if hi-lo>.1:beam(label+" deck handrail",ice,(lo,5,-8 if festival else top_z),(hi,5,-8 if festival else top_z),.06)
    beam(label+" deck handrail",ice,(x-4.5,5,-19.6),(x+4.5,5,-19.6),.06)

if festival:
    # Restore the VIP room footprint, then join it by narrower U-shaped outer galleries.
    def gallery(x1,x2,z1,z2):box('U lounge floor',deck,x1,x2,z1,z2,3.64,4,True)
    gallery(-20,-16.2,-14.1,2)
    gallery(-21.2,-19.65,1.2,11.6)
    gallery(-21.2,-16.2,.5,2)
    gallery(-21.2,-16.2,10,11.6)
    gallery(-20,-16.2,10,18.4)
    gallery(16.2,20,-14.1,18.4)
    gallery(-21.4,-16,-14.1,-10.3)
    gallery(16,21.4,-14.1,-10.3)
    gallery(-2.7,2.7,14.8,20.2)
    octagon('U lounge floor',deck,0,18.4,40,3.6,1.8,3.64,4,True)
    gallery(9.85,11.15,16,17.6)
    rect('U lounge stair',deck,9.85,11.15,8,16,0,4,-.01,True)
    def guard(a,b):
        beam('U lounge rail',ice,(a[0],5,a[1]),(b[0],5,b[1]),.045)
        length=math.hypot(b[0]-a[0],b[1]-a[1]);count=max(1,math.ceil(length/2.5))
        for j in range(count+1):
            t=j/count;x=a[0]+(b[0]-a[0])*t;z=a[1]+(b[1]-a[1])*t
            box('U lounge post',metal,x-.045,x+.045,z-.045,z+.045,4,5)
    for a,b in [((-20,-10.3),(-20,1.2)),((-21.2,1.2),(-21.2,11.6)),
        ((-20,11.6),(-20,18.4)),((-16.2,-10.3),(-16.2,2)),((-16.2,10),(-16.2,16.6)),
        ((-19.65,2.1),(-19.65,9.9)),((16.2,-10.3),(16.2,16.6)),((20,-10.3),(20,18.4)),
        ((-16.2,16.6),(-2.7,16.6)),((2.7,16.6),(9.8,16.6)),((11.2,16.6),(16.2,16.6)),
        ((-18.2,20.15),(18.2,20.15)),((-20,18.4),(-18.2,20.15)),((20,18.4),(18.2,20.15)),
        ((-16,-14.1),(-16,-10.3)),((16,-14.1),(16,-10.3)),((-21.35,-14.1),(-21.35,-10.3)),((21.35,-14.1),(21.35,-10.3)),
        ((-21.35,-14.1),(-16,-14.1)),((16,-14.1),(21.35,-14.1)),
        ((-2.7,14.8),(2.7,14.8)),((-2.7,14.8),(-2.7,16.6)),((2.7,14.8),(2.7,16.6))]:guard(a,b)
    for edge in [9.9,11.1]:
        beam('U lounge rail',violet,(edge,1,8),(edge,5,16),.045)
        for i in range(5):
            z=8+2*i;box('U lounge post',metal,edge-.04,edge+.04,z-.04,z+.04,i,i+.95)
    for x,z in [(-19.5,12),(-19.5,16),(19.8,0),(-6.3,19.9),(6.3,19.9)]:
        box('U lounge support',metal,x-.12,x+.12,z-.12,z+.12,0,3.64)

# Frame the side rooms on their outer edges; their inner thresholds stay open.
for side in (-1,1):
    x=side*19.6
    # The east lounge stays open; retain its floor and route inlays below.
    if not festival:
        for z in [2.6,5.0,7.4,9.8]:
            box("Side room fins",metal,x-.20,x+.20,z-.20,z+.20,0,2.2)
        beam("Side room header",violet,(x,2.2,2.6),(x,2.2,9.8),.13)
        box("Side room parapet",wall,x-.12,x+.12,2.6,9.8,.05,.82)
        for z in [2.6,9.8]:
            beam("Side room return",rim,(x,2.2,z),(x-side*2.4,1.45,z),.13)
    for r in [9.5,10.1]:
        start=-.9 if side==1 else P-.9
        ring("Arena apron",violet,r,r+.12,start,start+1.8,.002,.028,32)
    # The two approach walls converge on the audience floor.
    beam("Lobby wings",metal,(side*3.9,1.0,20.7),(side*8.4,1.3,15.5),.27)
    beam("Lobby wing trim",ice,(side*3.9,1.25,20.7),(side*8.4,1.55,15.5),.08)
    if festival and side > 0:
        continue
    for z in ([] if festival else [-18,-15,-12,-9]):
        box("Upper deck fascia",violet,side*14.6-4.5,side*14.6+4.5,z,z+.07,4.002,4.018)
# Proscenium brackets distinguish the elevated stage from the two audience decks.
for side in (-1,1):
    beam("Stage surround",metal,(side*7.4,1.36,-17.85),(side*7.4,7.5,-17.85),.26)
    beam("Stage surround",metal,(side*7.4,7.5,-17.85),(side*4.8,8.55,-17.85),.26)
    beam("Stage surround trim",ice,(side*7.4,7.55,-17.52),(side*4.8,8.6,-17.52),.07)
beam("Stage surround",metal,(-4.8,8.55,-17.85),(4.8,8.55,-17.85),.26)

images, lights = {}, []
if festival:
    from festival.interior import scenery
    VERSION = 'EDM v3 · festival interior'
    images, lights = scenery(materials, material, box, octagon, ring, beam, tri)
    # Match edmStage.booth: move the original deck/mixer and front display with the booth.
    for (group,mat),(positions,normals) in list(parts.items()):
        if group=='Booth equalizer' or (group.startswith('DJ ') and group not in {'DJ booth','DJ platform','DJ access','DJ focus fixture body','DJ focus fixture lens','DJ focus fixture suspension'}):
            parts[(group,mat)]=([(x,y,z-2.7) for x,y,z in positions],normals)
    # Retire the old decorative frame behind the enlarged screen, preserving backdrop/rear wall.
    obsolete={'Stage fan','Stage pylons','Pylon trim','Stage surround','Stage surround trim'}
    for key in list(parts):
        if key[0] in obsolete:del parts[key]

route=[(0,0,25),(0,0,12),(0,.018,0),(0,.018,-7.6),(0,1.35,-10.05),(0,1.35,-13),
       (0,1.35,-10.05),(0,.018,-7.6),(0,.018,0),(-14.6,.045,6),(0,.018,0),
       (14.6,.045,6),(14.6,0,0),(14.6,4,-8),(14.6,4,-13),(10.1,4,-13)]
stops=dict(entry=0,floor=2,stage=5,west=9,east=11,balcony=15)
if festival:
    # Stop in front of the relocated booth, keeping the approach and return clear.
    route[5] = (0,1.35,-11.2)
    route[9:] = [(-14.6,.045,6),(0,.018,0),(14.6,0,6),
                  (-17.9,.045,10.6),(-17.9,.045,10),(-17.9,4,2),
                  (-17.9,4,-10.65),(-17.1,4,-10.65),(-17.1,4,-12.2)]
    stops.update(west=9,east=11,balcony=17)
def ground(x,z):
    top=-999
    for (ax,ay,az),(bx,by,bz),(cx,cy,cz) in walkable:
        det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
        if abs(det)<1e-10:continue
        u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det
        v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det
        if min(u,v,1-u-v)>=-1e-6:top=max(top,u*ay+v*by+(1-u-v)*cy)
    return top
# Allow small trim and threshold transitions.
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
        if g!=group: continue
        attributes=dict(POSITION=attr(pos), NORMAL=attr(norm))
        if m in images:
            uv=[images[m][1](*point) for point in pos]
            offset=len(buf)
            for coords in uv: buf.extend(struct.pack('<2f',*coords))
            views.append(dict(buffer=0,byteOffset=offset,byteLength=len(buf)-offset,target=34962))
            access.append(dict(bufferView=len(views)-1,componentType=5126,count=len(uv),type='VEC2'))
            attributes['TEXCOORD_0']=len(access)-1
        primitives.append(dict(attributes=attributes,material=m))
    meshes.append(dict(name=group,primitives=primitives));nodes.append(dict(name=group,mesh=len(meshes)-1))
doc=dict(asset=dict(version="2.0",generator="meta-club "+VERSION),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(buf))],bufferViews=views,accessors=access,extras=dict(version=VERSION,unit="metre",reviewRoute=route,eyeHeight=1.65,stageIndex=stops["stage"],stops=stops))
if festival:
    doc.update(images=[],textures=[],extensionsUsed=['KHR_lights_punctual'],
               extensions={'KHR_lights_punctual':{'lights':[data for _,_,data in lights]}})
    for mat,(png,_) in images.items():
        offset=len(buf);buf.extend(png)
        views.append(dict(buffer=0,byteOffset=offset,byteLength=len(png)))
        doc['images'].append(dict(bufferView=len(views)-1,mimeType='image/png'))
        texture=len(doc['textures'])
        doc['textures'].append(dict(source=len(doc['images'])-1))
        materials[mat]['pbrMetallicRoughness']['baseColorTexture']={'index':texture}
        materials[mat]['emissiveTexture']={'index':texture}
        buf.extend(bytes(-len(buf)%4))
    for index,(name,xyz,_) in enumerate(lights):
        doc['scenes'][0]['nodes'].append(len(nodes))
        nodes.append(dict(name=name,translation=xyz,extensions={'KHR_lights_punctual':{'light':index}}))
    doc['buffers'][0]['byteLength']=len(buf)
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(js)+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf
if festival:
    (ROOT/'festival'/'edm-festival.glb').write_bytes(glb)
else:
    (ROOT/'edm-empty.glb').write_bytes(glb)
    (ROOT/'review.html').write_text((ROOT/'review.template').read_text().replace('__GLB__',base64.b64encode(glb).decode()))
print(VERSION,len(glb),'bytes;',len(route),'waypoints; asset generated')
