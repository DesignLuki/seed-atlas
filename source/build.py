"""Build the editable, relative-scale seed exhibition maquette in a new background process."""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector, Quaternion, noise
from math import sin,cos,pi
D=Path(__file__).resolve().parents[1]
cat=json.loads((D/'source/catalog.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(37)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.unit_settings.system='NONE'
mats={}
def mat(name,hexcode,metal=0,rough=.4,alpha=1):
    raw=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in raw]
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for k,v in [('Base Color',(*rgb,1)),('Metallic',metal),('Roughness',rough),('Alpha',alpha)]:p.inputs[k].default_value=v
    m.diffuse_color=(*rgb,alpha);mats[name]=m
for args in [('basalt','263e38',.48),('jade','375343',.38),('mint','abdbb1',.2),('porcelain','d7dace',.13),('silver','b4c2bc',.52),('ink','384943'),('gold','db9e29',.16),('lemon','f2b63c'),('leaf','69a13c',0,.61),('vein','a3c954'),('forest','306734',0,.57),('soil','60412b',0,.94),('loam','805a3d',0,.88),('grain','d8ac76'),('sage','a2ad6d'),('glass','c7e6dc',.05,.16,.33)]:mat(*args)
def coord(u,v):
    h=(u-1070)/58; d=(v-378)/(58*.49)
    return (.877*h+.481*d,.481*h-.877*d)
def root(id,x,y,z,parent=None):
    o=bpy.data.objects.new(id,None);scene.collection.objects.link(o);o.parent=parent;o.location=(x,y,z);o.empty_display_size=.17;return o
def mesh(name,vs,fs,material,loc=(0,0,0),smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.materials.append(mats[material]);me.update()
    o=bpy.data.objects.new(P.name+'_'+name,me);scene.collection.objects.link(o);o.parent=P;o.location=loc
    if smooth:
        for poly in me.polygons:poly.use_smooth=True
    return o
def rings(name,rows,m,loc=(0,0,0),smooth=False):
    n=len(rows[0]);vs=sum(rows,[]);fs=[tuple(reversed(range(n)))]
    for j in range(len(rows)-1):
        for i in range(n):
            k=j*n+i;l=j*n+(i+1)%n;fs.append((k,l,l+n,k+n))
    fs.append(tuple(range(len(vs)-n,len(vs))));return mesh(name,vs,fs,m,loc,smooth)
def box(name,x,y,z,w,d,h,m,r=.055):
    r=min(r,w*.24,d*.24,h*.32);rows=[]
    for zz,inset in [(0,r*.57),(r*.52,0),(h-r*.52,0),(h,r*.57)]:
        line=[]
        for q,(sx,sy) in enumerate([(1,1),(-1,1),(-1,-1),(1,-1)]):
            for k in range(4):
                a=(q+k/3)*pi/2
                line.append((sx*(w/2-r)+cos(a)*(r-inset),sy*(d/2-r)+sin(a)*(r-inset),zz))
        rows.append(line)
    return rings(name,rows,m,(x,y,z))
def radial(name,x,y,z,profile,m,n=32):
    return rings(name,[[(rx*cos(i*2*pi/n),ry*sin(i*2*pi/n),zz) for i in range(n)] for zz,rx,ry in profile],m,(x,y,z),True)
def cylinder(name,x,y,z,r,h,m):
    e=min(.014,h*.16);return radial(name,x,y,z,[(0,r*.96,r*.96),(e,r,r),(h-e,r,r),(h,r*.96,r*.96)],m)
def oval(name,x,y,z,rx,ry,rz,m,tilt=0,az=0):
    profile=[(rz*sin(a),rx*cos(a),ry*cos(a)) for a in [(-.495+i*.99/8)*pi for i in range(9)]]
    o=radial(name,x,y,z,profile,m,16);o.rotation_euler=(0,tilt,az);return o
def rod(name,start,end,r,m):
    a=Vector(start);dv=Vector(end)-a;o=cylinder(name,*a,r,dv.length,m);o.rotation_euler=dv.to_track_quat('Z','Y').to_euler();return o
def leaf(name,x,y,z,length,width,az,rise,m):
    rows=[]
    for i in range(11):
        t=i/10; w=width*(.012+sin(pi*t)**.8); cz=rise*t+length*.22*sin(pi*t)
        # The local cross section is counterclockwise viewed from the end of the leaf.
        rows.append([(length*t,w,cz),(length*t,w*.06,cz+w*.218),(length*t,0,cz+w*.24),(length*t,-w*.06,cz+w*.218),(length*t,-w,cz),(length*t,0,cz-w*.14)])
    o=rings(name,rows,m,(x,y,z),True);o.rotation_euler.z=az
    o.data.materials.append(mats['vein'])
    for face in list(o.data.polygons)[1:-1]:
        if (face.index-1)%6 in (1,2):face.material_index=1
def plant(h,bushy=False):
    rod('stem',(0,0,.12),(.025,0,h),.019 if bushy else .025,'forest')
    for i in range(12 if bushy else 7):
        t=i/(12 if bushy else 7);a=i*2.39;l=(.53-.21*t)*(1 if bushy else .95);height=h*(.32+.66*t)
        leaf('blade',.01,0,height,l,.10 if bushy else .135,a,.14+.05*t,'leaf' if i%2 else 'forest')
        if bushy:
            for side in [-1,1]:
                leaf('leaflet',cos(a)*l*.36,sin(a)*l*.36,height+.14,l*.45,.059,a+side*.65,.07,'leaf')
def grains(dish=False):
    if dish:
        radial('dish',0,0,0,[(0,.48,.48),(.05,.56,.56),(.13,.56,.56),(.14,.51,.51),(.072,.50,.50)],'porcelain')
    else:
        box('tray',0,0,0,1.12,.88,.085,'porcelain')
        for s in [-1,1]:
            box('rim',0,s*.421,.07,1.12,.04,.14,'porcelain',.014)
            box('rim',s*.541,0,.07,.04,.80,.14,'porcelain',.014)
    for i in range(5):
        for j in range(6):
            x=(j-2.5)*.159+random.uniform(-.025,.025);y=(i-2)*.145+random.uniform(-.023,.023)
            if dish and x*x+y*y>.20:continue
            oval('kernel',x,y,.12,.088,.057,.056,'sage' if dish and (i+j)%2 else 'grain',.16,random.uniform(-pi,pi))
def build_asset(a):
    if a=='A01':grains()
    elif a=='A02':
        box('tray',0,0,0,1.12,.88,.18,'porcelain');box('soil',0,0,.173,1.03,.79,.03,'soil')
        for i in range(4):
            for j in range(3):
                x=(i-1.5)*.255;y=(j-1)*.25
                for k in range(3):leaf('seedling',x,y,.199,.13,.052,k*2.09+i,.12,'leaf' if k%2 else 'forest')
    elif a=='A03':
        box('case',0,0,0,1.19,.86,.5,'silver');box('gasket',0,0,.48,1.20,.87,.046,'ink')
        box('lid',0,0,.518,1.23,.90,.096,'porcelain');box('label',0,0,.611,.58,.35,.012,'mint')
        for k in range(4):box('lidprint',-.09,.09-.052*k,.622,.23-.016*k,.012,.005,'forest',.002)
        for x in [-.38,.38]:box('latch',x,-.45,.34,.09,.075,.19,'silver',.02)
    elif a=='A04':
        box('body',0,0,0,1.21,.85,.39,'silver');box('front',0,-.422,.095,.88,.028,.22,'ink')
        box('key',-.25,-.441,.15,.17,.025,.08,'gold');box('cap',0,0,.38,1.31,.94,.11,'porcelain');box('screen',0,0,.486,.78,.52,.015,'leaf')
        for k in range(7):box('vent',.604,-.23+k*.071,.14,.014,.023,.127,'ink',.004)
        for k in range(3):box('readout',-.18,k*.095-.1,.499,.24,.025,.006,'mint',.002)
    elif a=='A05':
        for j in range(2):
            rows=[]; n=120
            for k in range(121):
                t=k/120;radius=.178*(.023+.977*sin(pi*(.08+.919*t))**.64)
                line=[]
                for i in range(n):
                    ang=2*pi*i/n
                    # Shallow grooves between the rounded, staggered kernel shoulders.
                    along=abs(cos(pi*(k/6)))**8
                    across=abs(cos(7.5*ang+.35*sin(pi*k/6)+j))**9
                    rr=radius*(1-.10*along-.095*across)
                    line.append((rr*cos(ang),rr*sin(ang),1.22*t))
                rows.append(line)
            o=rings('ear',rows,'gold' if j else 'lemon',(j*.36-.22,-.20+.165*j,.0367),True)
            o.rotation_euler=(0,-.57,.18+j*.18)
            for face in o.data.polygons:
                if face.index%120 in (22,23,54) and face.index%13==0:
                    face.material_index=1
            o.data.materials.append(mats['lemon' if j else 'gold'])
    elif a=='A06':
        radial('dish',0,0,0,[(0,.35,.35),(.035,.41,.41),(.18,.41,.41),(.18,.38,.38),(.045,.37,.37)],'glass')
        cylinder('substrate',0,0,.039,.352,.075,'grain');plant(1.12)
    elif a=='A07':
        box('support',0,0,0,1.16,.93,.05,'porcelain')
        rows=[]
        for k in range(22):
            t=k/21; r=max(.014,(1-t)**.63)
            line=[]
            for i in range(88):
                a=i*2*pi/88;x=cos(a)*r;y=sin(a)*r
                coarse=noise.noise_vector(Vector((x*3.2,y*3.2,1.7))).x
                fine=noise.noise_vector(Vector((x*23,y*23,7.3))).x
                f=1+.13*coarse+.065*sin(3*a)
                height=.42*t+(coarse*.095+fine*.046)*min(1,t*12)
                line.append((x*.57*f,y*.44*f,height))
            rows.append(line)
        mound=rings('mound',rows,'soil',(0,0,.046),True)
        mound.data.materials.append(mats['loam'])
        for face in mound.data.polygons:
            face.material_index=1 if random.random()<.20 else 0
    elif a=='A08':box('plug',0,0,0,.85,.70,.14,'loam');plant(1.43,True)
    elif a=='A09':
        box('foot',0,0,0,.73,.30,.07,'silver');box('panel',0,0,.062,.74,.07,.92,'porcelain')
        box('heading',0,-.039,.76,.56,.015,.09,'leaf'); 
        for k in range(4):box('line',-.055,-.040,.62-k*.095,.43-k*.025,.013,.027,'sage',.003)
    elif a=='A10':
        box('holder',0,0,0,.68,.27,.10,'silver')
        for i in range(3):
            x=(i-1)*.208;h=.46+i*.04
            cylinder('tube',x,0,.09,.082,h,'glass');cylinder('fill',x,0,.11,.073,h*.57,'grain')
            cylinder('cap',x,0,.08+h,.088,.07,'porcelain')
            cylinder('band',x,0,.115+h*.65,.084,.082,'porcelain')
    elif a=='A11':
        oval('grain',0,0,.24,.12,.115,.26,'gold',.07)
        for s in [-1,1]:oval('wing',s*.113,s*.021,.60,.098,.105,.31,'gold',s*.45)
    elif a=='A12':
        for i in range(2):
            x=i*.48-.23;h=.62+i*.07
            cylinder('core',x,0,0,.229,h,'loam');cylinder('cut',x,0,h-.004,.217,.009,'grain')
    elif a=='A13':
        radial('bottle',0,0,0,[(0,.29,.29),(.035,.32,.32),(.39,.32,.32),(.47,.24,.24),(.55,.235,.235)],'porcelain')
        cylinder('neck',0,0,.49,.24,.11,'silver');cylinder('lid',0,0,.57,.285,.093,'porcelain')
        cylinder('paper',0,0,.103,.323,.195,'porcelain');cylinder('band',0,0,.238,.325,.023,'sage')
    elif a=='A14':grains(True)
    elif a=='A15':
        rows=[]
        for z,w,d in [(0,.68,.26),(.055,.75,.32),(.18,.77,.30),(.52,.73,.22),(.72,.71,.16),(.94,.73,.054),(.99,.73,.05)]:
            rows.append([(-w/2,-d*.30,z),(-w*.32,-d*.51,z),(-w*.04,-d*.54,z),(w*.31,-d*.50,z),(w/2,-d*.30,z),(w*.46,0,z),(w/2,d*.35,z),(w*.26,d*.5,z),(-w*.30,d*.50,z),(-w/2,d*.32,z),(-w*.46,0,z)])
        rings('pouch',rows,'porcelain');box('seal',0,0,.94,.755,.063,.056,'silver')
        o=box('label',0,-.151,.28,.57,.015,.30,'mint');o.rotation_euler.x=-.15
        o=box('stripe',0,-.133,.48,.53,.02,.09,'forest');o.rotation_euler.x=-.15
        for i in range(4):
            o=box('print',-.055,-.1541+i*.0047,.31+i*.031,.32-i*.023,.011,.009,'sage',.002)
            o.rotation_euler.x=-.15
stands={}
for id,label,u,v,w,d in cat['stations']:
    P=root(id,*coord(u,v),0);stands[id]=P;P['label']=label
    box('raft',0,0,0,w,d,.16,'basalt',.13)
    box('pinstripe',0,0,.153,w-.16,d-.16,.026,'mint',.025)
    box('inset',0,0,.174,w-.21,d-.21,.034,'jade',.032)
for id,label,station,u,v,_,__,___ in cat['items']:
    x,y=coord(u,v);sp=stands[station];ax=x-sp.location.x;ay=y-sp.location.y
    if id!='A10':
        px,py=coord(1068,399) if id=='A09' else (x,y)
        P=root('plinth_'+id,px-sp.location.x,py-sp.location.y,.204,sp)
        w,d=(1.45,1.29) if id not in ['A11','A12'] else (1.25,1.19)
        if id=='A09':w,d=1.85,1.43
        box('foot',0,0,0,w+.15,d+.14,.12,'basalt');box('tier',0,0,.112,w+.09,d+.08,.073,'mint')
        box('cap',0,0,.179,w,d,.09,'porcelain')
    P=root(id,ax,ay,.472,sp);P['label']=label;build_asset(id)
# Double tracks on the common ground plane. Smooth projected turns with Chaikin interpolation.
routes=[[(625,185),(932,276)],[(888,252),(1012,153),(1260,215)],[(889,254),(750,346),(779,359),(995,420)],[(1050,390),(1305,466),(1508,291),(1282,228)],[(1409,379),(1542,421),(1647,329)],[(1543,415),(1446,504),(1670,563)]]
P=root('tracks',0,0,0)
for j,points in enumerate(routes):
    for sep in [-.081,.081]:
        line=[Vector((*coord(u,v),0)) for u,v in points]
        for _ in range(3):
            new=[line[0]]
            for a,b in zip(line,line[1:]):new.extend([.82*a+.18*b,.18*a+.82*b])
            line=new+[line[-1]]
        rows=[]
        for i,p in enumerate(line):
            direction=(line[min(i+1,len(line)-1)]-line[max(0,i-1)]).normalized()
            perp=Vector((-direction.y,direction.x,0));center=p+sep*perp;vv=[]
            for k in range(6):
                angle=2*pi*k/6;vv.append(tuple(center+perp*(.014*cos(angle))+Vector((0,0,.018+j*.032+.014*sin(angle)))))
            rows.append(vv)
        rings('route'+str(j),rows,'mint')
bpy.context.view_layer.update()
# Store a usable authoring viewpoint when the native file is opened.
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        v=area.spaces.active;v.region_3d.view_rotation=Vector((-.481,.877,-.562)).to_track_quat('-Z','Y')
        v.region_3d.view_distance=32;v.region_3d.view_perspective='ORTHO';v.shading.color_type='MATERIAL'
focus=Vector((1,0,.3));view_dir=Vector((.481,-.877,.562)).normalized()
def studio_light(name,position,power,size,shade):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=shade
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=position;ob.rotation_euler=(focus-ob.location).to_track_quat('-Z','Y').to_euler()
studio_light('Softbox',(-6,-6,13),1900,8,(1,.91,.72))
studio_light('Edge light',(5,8,11),2700,9,(.75,1,.86))
cam=bpy.data.cameras.new('Panorama');cam.type='ORTHO';cam.ortho_scale=29
ob=bpy.data.objects.new('Panorama',cam);scene.collection.objects.link(ob);ob.location=focus+view_dir*36;ob.rotation_euler=(-view_dir).to_track_quat('-Z','Y').to_euler();scene.camera=ob
scene.render.resolution_x=1920;scene.render.resolution_y=800
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(D/'assets/seed-exhibits.blend'))
bpy.ops.export_scene.gltf(filepath=str(D/'assets/seed-exhibits.glb'),export_format='GLB',export_extras=True,export_yup=True)
