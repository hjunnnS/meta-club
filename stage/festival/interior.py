"""Scenic dressing for the approved v3 footprint. Coordinates are in metres."""
from pathlib import Path
import math
import random
import struct
import zlib

def png(width, height, sample):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind+data))
    pixels = bytearray()
    for y in range(height):
        pixels.append(0)
        for x in range(width):
            pixels.extend(sample(x, y))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB',width,height,8,2,0,0,0))
            + chunk(b'IDAT',zlib.compress(pixels,9)) + chunk(b'IEND',b''))

def scenery(materials, material, box, octagon, ring, beam, tri):
    pi=math.pi
    rng=random.Random(51)
    images={}
    lights=[]
    def finish(name,rgb,metal=0,rough=.5,emission=None):
        i=material(name,rgb)
        p=materials[i]['pbrMetallicRoughness']
        p.update(metallicFactor=metal,roughnessFactor=rough)
        if emission: materials[i]['emissiveFactor']=emission
        return i
    ink=finish('Powder coated steel',(.048,.045,.072),.35)
    silver=finish('Anodised aluminium',(.30,.32,.41),.50,.28)
    stone=finish('Obsidian counter',(.15,.095,.14),.32,.22)
    brass=finish('Satin champagne',(.61,.31,.115),.48,.33)
    seat=finish('Aubergine velvet',(.39,.064,.18),0,.94)
    wood=finish('Fluted walnut',(.27,.103,.045),.06,.68)
    indigo=finish('Indigo acoustic felt',(.072,.049,.147),0,.95)
    black=finish('Speaker grille',(.015,.019,.028),.12,.71)
    lamps=[finish(n,c,0,.32,c) for n,c in [
        ('Orchid LED',(.62,.018,1)),('Ice LED',(.045,.64,1)),('Rose LED',(1,.035,.36)),
        ('Amber LED',(1,.47,.095)),('Pearl LED',(.72,.86,1))]]
    purple,cyan,pink,gold,white=lamps
    for m in materials[:11]:
        m['pbrMetallicRoughness']['roughnessFactor']=.53
    def post(name,mat,x,y,z,r,h):
        beam(name,mat,(x,y,z),(x,y+h,z),r)
    def ellipse(name,mat,x,y,z,rx,rz,r,n=64):
        for j in range(n):
            a,b=2*pi*j/n,2*pi*(j+1)/n
            beam(name,mat,(x+rx*math.cos(a),y,z+rz*math.sin(a)),(x+rx*math.cos(b),y,z+rz*math.sin(b)),r)
    def lamp(name,xyz,color,intensity,reach):
        lights.append((name,xyz,dict(type='point',color=color,intensity=intensity,range=reach)))
    # Radiating, individually inlaid glass sectors preserve the floor height.
    for row in range(7):
        for j in range(48):
            a,b=2*pi*j/48,2*pi*(j+1)/48
            k=(row+j//4)%3
            mats=[indigo,ink,stone]
            ring('Inlaid smoked glass',mats[k],.55+row*1.08,1.60+row*1.08,a+.002,b-.002,.0181,.021,2)
            if (j+row)%7==0:
                ring('Pixel traces',lamps[(row+j)%3],.62+row*1.08,.66+row*1.08,a+.008,b-.008,.021,.024,2)
    for r in [1.16,4.88,7.98]:
        ring('Flush optical fibre',purple,r,r+.025,0,2*pi,.022,.027,128)
    # Truss halo and chain suspension, set well above the two sight lines.
    for radius,y in [(8.45,7.95),(8.45,8.45),(8.12,8.18)]:
        ellipse('Arena lighting truss',silver,0,y,0,radius,radius,.055)
    for j in range(48):
        a,b=j*2*pi/48,(j+1)*2*pi/48
        beam('Truss diagonals',ink,(8.45*math.cos(a),7.95,8.45*math.sin(a)),(8.45*math.cos(b),8.45,8.45*math.sin(b)),.043)
        if j%3==0:
            x,z=8.45*math.cos(a),8.45*math.sin(a)
            post('Moving heads',black,x,7.61,z,.17,.32)
            post('Optics',lamps[(j//3)%3],x,7.59,z,.132,.035)
            if j%6==0:post('Suspension drops',ink,x,8.45,z,.025,2.55)
    halo=finish('Muted violet truss strip',(.11,.05,.22),0,.8,(.18,.06,.34))
    ellipse('LED halo',halo,0,7.91,0,8.44,8.44,.044)
    # The LED artwork is baked into the actual GLB for independent viewers.
    def led_pixel(x,y):
        u=(x+.5)/768*2-1;v=1-(y+.5)/384*2
        a=math.atan2(v-.04,u*1.55);r=math.hypot(u*1.55,v-.04)
        warp=.19*math.sin(3*a+1.6*r)+.11*math.cos(5*a-4*r)
        phase=12*(r+warp)+2.5*a
        line=math.exp(-13*abs(math.sin(phase)))
        fine=math.exp(-19*abs(math.sin(phase*2+.35)))
        haze=.12+.23*(.5+.5*math.cos(phase))**4
        t=.5+.5*math.sin(2*a+4*r)
        rgb=(100+146*t,35+170*(1-t),250-32*t)
        level=(haze+.88*line+.21*fine)*(.82 if y%3==0 else 1)
        return [min(255,round(c*level+5)) for c in rgb]
    screen=finish('LED / chromatic vortex',(1,1,1),0,.7,(1,1,1))
    images[screen]=(png(768,384,led_pixel),lambda x,y,z:((x+6.55)/13.1,(8.35-y)/5.70))
    box('Festival LED wall',screen,-6.55,6.55,-18.1,-18.03,2.65,8.35)
    for s in [-1,1]:
        for i in range(4):
            x=s*(7.3+.53*i)
            y=7.9-.47*i
            box('Wing blade housings',ink,x-.22,x+.22,-17.60,-17.24,2,y)
            for j in range(13):
                yy=2.2+j*(y-2.4)/13
                box('LED wing arrays',lamps[(i+j//5)%3],x-.14,x+.14,-17.23,-17.19,yy,yy+.15)
        for j in range(5):
            x=s*(6.5+.04*j);y=6.8-j*.48
            box('Flown line arrays',black,x-.43,x+.43,-14.7,-14.08,y,y+.43)
            for k in range(3):box('Array grille ribs',silver,x-.34,x+.34,-14.065,-14.05,y+.08+k*.10,y+.096+k*.10)
        for i in range(10):
            x=s*(.33+.28*i)
            box('Booth equalizer',cyan if i%3 else pink,x-.045,x+.045,-14.896,-14.87,1.56,1.7+.45*abs(math.sin(i)))
        for i in range(4):
            x=s*(2.1+i*1.35);near=(x,1.58,-11.1);far=(s*(7.0+i*1.7),8.85-i*.28,-8.5+i*1.4)
            post('Stage spot body',black,x,1.35,-11.1,.22,.23)
            tint=[(.25,.046,1),(.025,.37,1),(1,.023,.37)][i%3]
            haze=finish('Beam wash '+str(s)+' '+str(i),tint,0,1,tint)
            materials[haze].update(alphaMode='BLEND',doubleSided=True)
            materials[haze]['pbrMetallicRoughness']['baseColorFactor'][3]=.018
            for j in range(12):
                a,b=2*pi*j/12,2*pi*(j+1)/12
                def edge(t):return (far[0]+.48*math.cos(t),far[1],far[2]+.48*math.sin(t))
                tri('Haze shafts',haze,near,edge(b),edge(a))
    # Side walls with stepped acoustic cassettes, upright grazers and ceiling ribs.
    for s in [-1,1]:
        for j in range(16):
            z=-19+j*2.55
            box('Perimeter acoustic bays',indigo,s*21.8-.18,s*21.8+.18,z,z+2.46,.1,7.75)
            for k in range(4):
                x=s*21.53
                box('Ribbed acoustic facing',ink,x-.07,x+.07,z+k*.58,z+k*.58+.22,.35,7.45)
            if j%2==0:beam('Perimeter wall light',purple,(s*21.4,1,z+.28),(s*21.4,6.75,z+.28),.045)
        for j in range(6):
            z=-18+j*7
            beam('Roof ribs',ink,(s*21.7,7.7,z),(s*7.5,11,z),.125)
            beam('Roof ribs',ink,(s*7.5,11,z),(0,11.25,z),.10)
        if s > 0:
            continue
        # Leave the inner part of each elevated deck and its ramp clear.
        for j in range(3):
            x=s*18.05;z=-18+j*2.9
            octagon('Deck banquettes',seat,x,z,2.25,2.2,.20,4.14,4.55)
            box('Deck backrests',seat,x-.94,x+.94,z-.98,z-.66,4.42,5.06)
    # Rotate the complete bar 180 degrees around (-13.65, 16.2).
    # The tall bottle display moves behind the stools, clearing the stage sightline.
    def bar_box(name,mat,x1,x2,z1,z2,lo,hi):
        box(name,mat,-27.3-x2,-27.3-x1,32.4-z2,32.4-z1,lo,hi)
    def bar_octagon(name,mat,x,z,*shape):
        octagon(name,mat,-27.3-x,32.4-z,*shape)
    def bar_beam(name,mat,a,b,r):
        beam(name,mat,(-27.3-a[0],a[1],32.4-a[2]),(-27.3-b[0],b[1],32.4-b[2]),r)
    def bar_post(name,mat,x,y,z,r,h):
        post(name,mat,-27.3-x,y,32.4-z,r,h)
    # West entry bar, tucked outboard of the v3 approach wings.
    bar_octagon('Bar base',wood,-13.65,16.2,9.7,1.35,.28,.02,1.16)
    bar_octagon('Bar stone slab',stone,-13.65,16.2,10.05,1.65,.31,1.15,1.29)
    for j in range(37):
        x=-18.1+j*.246
        bar_box('Fluted bar front',brass,x,x+.052,16.86,16.90,.13,1.09)
    bar_beam('Underbar amber',gold,(-18.28,1.12,16.92),(-9.05,1.12,16.92),.038)
    for x in [-17.6,-15.65,-13.7,-11.75,-9.8]:
        bar_post('Stool foot',brass,x,.02,17.95,.33,.08)
        bar_post('Stool stem',silver,x,.10,17.95,.068,.66)
        bar_post('Upholstered stools',seat,x,.76,17.95,.35,.15)
    bar_box('Backbar cabinet',wood,-18.6,-9.05,13.62,14.0,0,3.8)
    bottleMats=[finish('Bottle '+str(i),c,.15,.21) for i,c in enumerate([(.08,.35,.23),(.66,.26,.06),(.30,.48,.58)])]
    for row in range(3):
        y=1.16+row*.87
        bar_box('Bottle shelves',brass,-18.5,-9.15,13.95,14.50,y,y+.07)
        bar_beam('Backbar shelf light',gold,(-18.4,y+.08,14.02),(-9.25,y+.08,14.02),.045)
        for k in range(25):
            x=-18.15+k*.36+rng.uniform(-.045,.045);h=rng.uniform(.23,.39);m=rng.choice(bottleMats)
            bar_post('Backbar bottles',m,x,y+.08,14.24,.073,h)
            bar_post('Bottle necks',m,x,y+.08+h,14.24,.035,.14)
    # Extend the open east-wall booth row toward the entrance, numbered from the entrance toward the stage.
    booth=finish('Booth midnight plum',(.17,.065,.25),0,.88,(.015,.005,.025))
    piping=finish('Booth muted cyan',(.08,.52,.64),.15,.5,(.025,.22,.28))
    top=finish('Booth smoked stone',(.10,.08,.17),.28,.32)
    for index,z in enumerate([16.6,12.0,7.4,2.8,-2.0,-6.8,-11.6,-16.2], start=1):
        # Back bench, two returns and an unobstructed central opening toward -X.
        octagon('Wall booth base',ink,19.0,z,3.8,4.4,.20,.01,.17)
        octagon('Wall booth seat',booth,20.05,z,1.12,4.05,.12,.17,.57)
        box('Wall booth back',booth,20.52,20.82,z-2.08,z+2.08,.42,1.36)
        for side in [-1,1]:
            zz=z+side*1.65
            octagon('Wall booth seat',booth,18.55,zz,2.38,.92,.12,.17,.57)
            box('Wall booth back',booth,17.35,19.85,zz+side*.46-.10,zz+side*.46+.10,.42,1.24)
            beam('Wall booth cyan piping',piping,(20.45,1.31,z+side*1.98),(17.42,1.18,z+side*1.98),.025)
        beam('Wall booth back piping',piping,(20.49,1.36,z-1.98),(20.49,1.36,z+1.98),.025)
        octagon('Wall booth table',top,18.5,z,1.35,1.4,.16,.62,.72)
        for xx in [18.95,18.05]:
            for zz in [z-.46,z+.46]:post('Wall booth leg',brass,xx,.04,zz,.045,.58)
        beam('Wall booth table glow',purple,(17.82,.69,z-.49),(17.82,.69,z+.49),.022)
        post('Wall booth lantern',gold,18.5,.73,z,.065,.18)
        # Small number plaques attach to the aisle-facing lower front of each return seat.
        number=finish('Table number '+str(index),(1,1,1),0,.65,(.72,.72,.72))
        digits={1:['010','110','010','010','111'],2:['111','001','111','100','111'],
                3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],
                6:['111','100','111','101','111'],7:['111','001','010','010','010'],
                8:['111','101','111','101','111']}
        glyph=digits[index]
        def number_pixel(x,y,glyph=glyph):
            if x<5 or x>122 or y<5 or y>122:return [80,196,218]
            col=(x-37)//18;row=(y-19)//18
            if 0<=col<3 and 0<=row<5 and glyph[row][col]=='1':return [246,235,255]
            return [24,12,39]
        images[number]=(png(128,128,number_pixel),lambda x,y,zz,center=z+1.65:((zz-center+.14)/.28,(.49-y)/.26))
        box('Table number '+str(index),number,17.325,17.345,z+1.51,z+1.79,.23,.49)
    # Full-size speaker stacks on the west pad; the stair approach stays open.
    for z in [3.6,8.3]:
        box('West speaker plinth',ink,-19.65,-17.25,z-1.38,z+1.38,.055,.26)
        box('West speaker cabinet',black,-19.45,-17.55,z-1.18,z+1.18,.26,3.65)
        for yy in [.29,3.60]:
            beam('West speaker trim',cyan,(-17.53,yy,z-1.13),(-17.53,yy,z+1.13),.025)
        for zz in [z-1.15,z+1.15]:
            beam('West speaker trim',ink,(-17.51,.30,zz),(-17.51,3.6,zz),.055)
        for yy in [1.0,2.20]:
            for j in range(32):
                a,b=j*2*pi/32,(j+1)*2*pi/32
                edge_a=(-17.47,yy+.53*math.cos(a),z+.53*math.sin(a))
                edge_b=(-17.47,yy+.53*math.cos(b),z+.53*math.sin(b))
                beam('West speaker woofer rim',silver,edge_a,edge_b,.025)
                tri('West speaker woofer',indigo,(-17.52,yy,z),edge_a,edge_b)
                cap_a=(-17.49,yy+.17*math.cos(a),z+.17*math.sin(a))
                cap_b=(-17.49,yy+.17*math.cos(b),z+.17*math.sin(b))
                tri('West speaker dust cap',black,(-17.40,yy,z),cap_a,cap_b)
        box('West speaker horn',silver,-17.54,-17.50,z-.88,z+.88,2.91,3.38)
        box('West speaker horn mouth',black,-17.49,-17.47,z-.75,z+.75,2.99,3.30)
        for j in range(7):
            zz=z-.66+j*.22
            beam('West speaker horn grille',ink,(-17.45,3.01,zz),(-17.45,3.28,zz),.018)
    # Rotate the existing bar pendants with the counter and bottle display.
    for x,z in [(-17,15),(-11,15)]:
        bar_post('Pendant cable',ink,x,3.3,z,.022,4.3)
        bar_post('Pendant brass shade',brass,x,3.09,z,.40,.24)
        bar_post('Pendant diffuser',gold,x,3.06,z,.335,.035)
        lamp('Amber pendant',(-27.3-x,2.96,32.4-z),(1,.47,.17),80,8)
    for x,z,c in [(-5,-13,(.22,.15,1)),(5,-13,(1,.06,.37)),(-8,0,(.33,.12,1)),(8,0,(.06,.52,1))]:
        lamp('Stage wash',(x,4.4,z),c,190 if z==-13 else 115,16)
    # Close the vista beyond the entrance without enclosing the entry corridor.
    for side in (-1,1):
        x=side*12.5
        box('Entrance return walls',indigo,x-8,x+8,20.8,21.12,0,7.6)
        for j in range(8):
            xx=side*(5+j*2.05)
            box('Entry acoustic cassettes',ink,xx-.83,xx+.83,20.60,20.79,.45,6.9)
            beam('Entry wall grazers',pink,(xx-.65,1.1,20.53),(xx+.55,5.35,20.53),.032)
        for j in range(3):
            xx=side*(4.2+.48*j)
            beam('Portal uprights',silver,(xx,0,20.0),(xx,5.1+j*.24,20.0),.11)
            beam('Portal return',purple,(xx,5.1+j*.24,20.0),(side*2.7,6.1+j*.24,20),.044)
            beam('Portal crown',purple,(side*2.7,6.1+j*.24,20),(0,6.1+j*.24,20),.044)
        # Stadium-facing side of the bar, and piping on the lounge booths.
        for j in range(8):
            zz=-19+j*4.9
            beam('Wall cornice',silver,(side*21.2,6.75,zz),(side*21.2,6.75,min(20.5,zz+4.7)),.11)
        if side > 0:
            continue
        for j in range(19):
            xx=side*(9.45+j*.56)
            box('Deck fascia flutes',brass,xx-.047,xx+.047,-8.30,-8.22,3.64,3.98)
        # Side deck feature wall in the upper lounges.
        for j in range(6):
            xx=side*(10.4+j*1.7)
            box('Mezzanine rear panels',indigo,xx-.76,xx+.76,-20.55,-20.25,4.1,7.9)
            beam('Mezzanine chevrons',lamps[(j//2)%3],(xx-.55,5.5,-20.19),(xx+.5,6.75,-20.19),.05)
    for j in range(26):
        xx=-18.35+j*.35
        bar_box('Backbar arena face',brass,xx,xx+.035,13.55,13.62,.17,3.62)
    for yy in [.28,3.45]:
        bar_beam('Backbar arena cornice',gold,(-18.5,yy,13.5),(-9.17,yy,13.5),.04)
    # A perforated dark roof keeps the eye-level views inside the club.
    box('Ceiling',black,-23,23,-22,27,11.6,11.76)
    for j in range(32):
        xx=-21.7+j*1.4
        beam('Ceiling battens',ink,(xx,11.42,-21),(xx,11.42,26),.045)
    for j in range(180):
        xx=rng.uniform(-21,21);zz=rng.uniform(-20,22)
        post('Pin lights',white,xx,11.39,zz,.019 if j%6 else .038,.02)
    # Recessed lobby and floor-edge light strips flank the approved walking line.
    for side in (-1,1):
        for j in range(10):
            zz=10.25+j*.92
            box('Lobby brass joints',brass,side*2.85-.24,side*2.85+.24,zz,zz+.026,.022,.023)
        for j in range(4):
            xx=side*(7.1+.55*j)
            beam('Proscenium wing diagonals',lamps[j%3],(xx,1.7,-16.9),(xx+side*2.1,6.3-j*.28,-17.3),.055)
    def terrazzo(x,y):
        # Fine aggregate, tile reveals and coloured bounce from the arena halo.
        wx=(x+.5)/768*46-23;wz=(y+.5)/768*48-22
        radial=math.hypot(wx,wz)
        n=((x*19349663 ^ y*83492791 ^ (x*y*131)) & 255)/255
        tile=(int((wx+23)/1.65)*7+int((wz+22)/2.7)*11)%5
        joint=min((wx+23)%1.65,1.65-(wx+23)%1.65,(wz+22)%2.7,2.7-(wz+22)%2.7)<.025
        blue=math.exp(-abs(radial-8.5)*1.15)*(.6+.4*n)
        rose=math.exp(-((wx-2)/4.8)**2-((wz+9)/5.5)**2)
        lobby=math.exp(-min(abs(wx-3),abs(wx+3))*3)*(.3 if wz>9 else 0)
        base=(21+tile*2+n*8)*(0.46 if joint else 1)
        return [min(255,int(base+53*blue+68*rose)),min(255,int(base+8*blue+65*lobby)),min(255,int(base+18+110*blue+35*rose+90*lobby))]
    floorMat=next(i for i,m in enumerate(materials) if m['name']=='Arena · basalt')
    materials[floorMat]['pbrMetallicRoughness'].update(baseColorFactor=[1,1,1,1],roughnessFactor=.43)
    materials[floorMat]['emissiveFactor']=[.13,.13,.13]
    images[floorMat]=(png(768,768,terrazzo),lambda x,y,z:((x+23)/46,(z+22)/48))
    return images,lights
