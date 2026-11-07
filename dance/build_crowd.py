"""Deterministic crowd fixture. Metres, Y up. One skinned mannequin per actor."""
from pathlib import Path
import json
import math
import struct

ROOT = Path(__file__).resolve().parent
buffer = bytearray()
views, accessors, nodes, skins, meshes = [], [], [], [], []

def attribute(values, fmt, component, kind, bounds=False):
    while len(buffer) % 4:
        buffer.append(0)
    offset = len(buffer)
    for row in values:
        buffer.extend(struct.pack('<' + fmt, *row))
    views.append(dict(buffer=0, byteOffset=offset, byteLength=len(buffer)-offset))
    descriptor = dict(bufferView=len(views)-1, componentType=component, count=len(values), type=kind)
    if bounds:
        descriptor.update(min=list(map(min,zip(*values))), max=list(map(max,zip(*values))))
    accessors.append(descriptor)
    return len(accessors)-1

def node(name, **fields):
    nodes.append(dict(name=name, **fields))
    return len(nodes)-1

# Joint origins in bind space. Vertices are authored in this same coordinate system.
bones = [('hips',None,(0,.92,0)),('chest',0,(0,1.08,0)),('head',1,(0,1.48,0))]
for side, sign in [('L',-1),('R',1)]:
    arm=len(bones)
    bones.extend([(side+'Shoulder',1,(sign*.22,1.42,0)),(side+'Elbow',arm,(sign*.29,1.16,0))])
    leg=len(bones)
    bones.extend([(side+'Hip',0,(sign*.11,.89,0)),(side+'Knee',leg,(sign*.11,.50,0))])

positions,normals,joints,weights=[],[],[],[]
def triangle(a,b,c,joint):
    u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
    n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    length=math.sqrt(sum(x*x for x in n))
    if length<1e-10:return
    for point in [a,b,c]:
        positions.append(point);normals.append([x/length for x in n])
        joints.append((joint,0,0,0));weights.append((1,0,0,0))

def solid(joint, rings, sides=8):
    # Rings run bottom to top. Small bevels soften the silhouette.
    rows=[[(x+rx*math.cos(i*2*math.pi/sides),y,z+rz*math.sin(i*2*math.pi/sides))
           for i in range(sides)] for x,y,z,rx,rz in rings]
    for lower,upper in zip(rows,rows[1:]):
        for i in range(sides):
            j=(i+1)%sides
            triangle(lower[i],upper[i],upper[j],joint)
            triangle(lower[i],upper[j],lower[j],joint)
    for i in range(1,sides-1):
        triangle(rows[0][0],rows[0][i],rows[0][i+1],joint)
        triangle(rows[-1][0],rows[-1][i+1],rows[-1][i],joint)

solid(0,[(0,.83,0,.17,.11),(0,.94,0,.18,.13),(0,1.04,0,.15,.105)])
solid(1,[(0,.99,0,.15,.105),(0,1.18,0,.19,.13),(0,1.40,0,.225,.145),(0,1.47,0,.135,.10)])
solid(2,[(0,1.48,0,.085,.085),(0,1.55,0,.13,.12),(0,1.69,0,.14,.125),(0,1.78,0,.09,.09)])
for sign,arm,leg in [(-1,3,5),(1,7,9)]:
    solid(arm,[(sign*.29,1.14,0,.061,.065),(sign*.255,1.32,0,.085,.083),(sign*.22,1.44,0,.072,.075)])
    solid(arm+1,[(sign*.32,.91,-.03,.049,.054),(sign*.30,1.07,0,.065,.067),(sign*.29,1.16,0,.06,.064)])
    solid(leg,[(sign*.11,.49,0,.077,.075),(sign*.11,.72,0,.101,.105),(sign*.11,.9,0,.1,.10)])
    solid(leg+1,[(sign*.11,.095,.018,.053,.055),(sign*.11,.35,0,.077,.087),(sign*.11,.50,0,.073,.075)])
    solid(leg+1,[(sign*.11,.028,-.055,.083,.135),(sign*.11,.095,-.06,.083,.14),(sign*.11,.145,.0,.065,.077)])
attrs={key:attribute(values,fmt,comp,typ,key=='POSITION') for key,values,fmt,comp,typ in [
    ('POSITION',positions,'3f',5126,'VEC3'),('NORMAL',normals,'3f',5126,'VEC3'),
    ('JOINTS_0',joints,'4B',5121,'VEC4'),('WEIGHTS_0',weights,'4f',5126,'VEC4')]}
matrices=[[1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1] for _,_,(x,y,z) in bones]
inverse=attribute(matrices,'16f',5126,'MAT4')
colors=[(.26,.50,.9),(.65,.32,.92),(.08,.72,.75),(.89,.35,.42),(.96,.62,.10)]
materials=[dict(name='costume-'+str(i),pbrMetallicRoughness=dict(baseColorFactor=[*rgb,1],metallicFactor=0,roughnessFactor=.82)) for i,rgb in enumerate(colors)]

# A luminous 3D "AI" mark travels with each AI, identically in both engines.
positions,normals,joints,weights=[],[],[],[]
for x,y,w,h in [(-.09,2.00,.15,.025),(-.09,1.93,.15,.025),(-.155,1.93,.03,.16),(-.025,1.93,.03,.16),(.09,1.93,.035,.16)]:
    for sign in [-1,1]:
        quad=[(x-w/2,y-h/2,sign*.01),(x+w/2,y-h/2,sign*.01),(x+w/2,y+h/2,sign*.01),(x-w/2,y+h/2,sign*.01)]
        triangle(quad[0],quad[1],quad[2],0);triangle(quad[0],quad[2],quad[3],0)
materials.append(dict(name='AI marker',doubleSided=True,emissiveFactor=[1,.75,.08]))
meshes.append(dict(primitives=[dict(attributes=dict(POSITION=attribute(positions,'3f',5126,'VEC3',True),NORMAL=attribute(normals,'3f',5126,'VEC3')),material=5)]))
roots=[]
ai={3,16,29,42,55}
for i in range(65):
    name=f'actor{i:02}'; angle=i*math.pi*(3-math.sqrt(5));radius=6.65*math.sqrt((i+.5)/65)
    offset=[radius*math.cos(angle),.018,radius*math.sin(angle)]
    root=node(name,children=[])
    roots.append(root); ids=[]
    for joint,parent,pos in bones:
        origin=(0,0,0) if parent is None else bones[parent][2]
        translation=[v-u for v,u in zip(pos,origin)]
        if parent is None:translation=[v+o for v,o in zip(translation,offset)]
        ids.append(node(name+'_'+joint,translation=translation,children=[]))
        nodes[root if parent is None else ids[parent]]['children'].append(ids[-1])
    skins.append(dict(inverseBindMatrices=inverse,joints=ids,skeleton=ids[0]))
    meshes.append(dict(name=name+'_skin',primitives=[dict(attributes=attrs,material=4 if i in ai else i%4)]))
    nodes[root]['children'].append(node(name+'_body',mesh=len(meshes)-1,skin=i))
    if i in ai:nodes[root]['children'].append(node(name+'_AI',mesh=0,translation=offset))
for n in nodes:
    if not n.get('children'):n.pop('children',None)
doc=dict(asset=dict(version='2.0'),scene=0,scenes=[dict(nodes=roots)],nodes=nodes,skins=skins,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(buffer))],bufferViews=views,accessors=accessors,extras=dict(ai=sorted(ai),joints=[b[0] for b in bones]))
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4);buffer.extend(b'\0'*(-len(buffer)%4))
(ROOT/'crowd.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(buffer))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(buffer),b'BIN\0')+buffer)
