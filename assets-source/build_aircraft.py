import bpy, math, os
from mathutils import Vector
ROOT = r'C:\Users\91906\Desktop\Airbooking\aere'
# Separate scene preserves any work already open in Blender.
scene = bpy.data.scenes.new('AERE Aircraft Studio')
bpy.context.window.scene = scene
def mat(name,color,metal=0,rough=.35):
 m=bpy.data.materials.new(name); m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
ivory=mat('Pearl ceramic fuselage',(.82,.86,.88),.38,.25)
navy=mat('Midnight navy livery',(.018,.055,.085),.35,.28)
glass=mat('Smoked cockpit glass',(.018,.045,.065),.65,.14)
metal=mat('Brushed titanium',(.3,.36,.4),.85,.24)
dark=mat('Engine interior',(.025,.03,.035),.5,.5)
copper=mat('Warm champagne accent',(.65,.38,.18),.65,.27)
def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 return ob
def lathe(name,sections,material,y=0,z=0,segments=64):
 vs=[(x,y+r*math.cos(2*math.pi*j/segments),z+r*math.sin(2*math.pi*j/segments)) for x,r in sections for j in range(segments)]
 fs=[(i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j) for i in range(len(sections)-1) for j in range(segments)]
 return mesh(name,vs,fs,material)
body=lathe('Sculpted fuselage',[(-11,.03),(-10.8,.32),(-10.3,.65),(-9.4,.96),(-8.2,1.08),(-6,1.12),(4.9,1.12),(6.7,.98),(8,.72),(9.5,.4),(10.8,.08),(11,0)],ivory)
sub=body.modifiers.new('Continuous fuselage surface','SUBSURF');sub.levels=2
def panel(name,points,thickness,material):
 vs=[(x,y,z+dz) for dz in [-thickness/2,thickness/2] for x,y,z in points];n=len(points)
 fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 ob=mesh(name,vs,fs,material);bevel=ob.modifiers.new('Rounded precision edges','BEVEL');bevel.width=.06;bevel.segments=3
 ob.modifiers.new('Surface normals','WEIGHTED_NORMAL');return ob
for s in [-1,1]:
 panel('Swept main wing', [(-2,s*.8,-.28),(3.6,s*10.5,.35),(4.8,s*10.9,.42),(3,s*1.1,-.28)],.16,ivory)
 panel('Wingtip fin',[(3.6,s*10.5,.35),(4.4,s*11.1,1.6),(4.9,s*11.15,1.62),(4.8,s*10.9,.42)],.075,navy)
 panel('Horizontal stabilizer',[(7,s*.55,.3),(9,s*4.2,.65),(10,s*4.3,.65),(10,s*.4,.35)],.12,ivory)
 for k in [0,1,2]:
  panel('Wing flap seam',[(1.9+k*.3,s*(3+k*1.6),-.17),(3.6+k*.2,s*(4.6+k*1.6),.05),(3.63+k*.2,s*(4.6+k*1.6),.05),(1.93+k*.3,s*(3+k*1.6),-.17)],.018,metal)
 panel('Engine pylon',[(-1.6,s*3.6,-.35),(.8,s*3.6,-.35),(1.1,s*3.6,-1.3),(-1.3,s*3.6,-1.3)],.15,metal)
 ey=s*3.65;ez=-1.25
 lathe('Turbofan nacelle',[(-3.3,.68),(-3.2,.8),(-2.9,.85),(-1.6,.83),(-.6,.65),(-.5,.48)],ivory,ey,ez)
 lathe('Polished inlet rim',[(-3.3,.68),(-3.34,.71),(-3.31,.77),(-3.2,.8)],metal,ey,ez)
 lathe('Dark intake tunnel',[(-3.31,.68),(-2.75,.61)],dark,ey,ez)
 lathe('Engine spinner',[(-3.15,.02),(-3,.18),(-2.8,.22)],metal,ey,ez)
 for j in range(24):
  a=j*math.tau/24
  mesh('Fan blade', [(-2.88,ey+.18*math.cos(a),ez+.18*math.sin(a)),(-2.83,ey+.63*math.cos(a+.15),ez+.63*math.sin(a+.15)),(-2.77,ey+.62*math.cos(a+.28),ez+.62*math.sin(a+.28)),(-2.8,ey+.21*math.cos(a+.25),ez+.21*math.sin(a+.25))],[(0,1,2,3)],metal)
 for i in range(43):
  x=-7.6+i*.30
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(x,s*1.067,.30))
  ob=bpy.context.object;ob.name='Cabin window';ob.scale=(.086,.027,.13);ob.data.materials.append(glass)
 for x in [-7.9,-.3,5.7]:
  panel('Door outline',[(x,s*1.098,-.35),(x+.35,s*1.098,-.35),(x+.35,s*1.098,.68),(x,s*1.098,.68)],.02,metal)
  panel('Door panel',[(x+.025,s*1.115,-.32),(x+.325,s*1.115,-.32),(x+.325,s*1.115,.65),(x+.025,s*1.115,.65)],.02,ivory)
 # Cockpit glazing follows the tapered nose.
 mesh('Cockpit glazing',[(-10.18,s*.48,.43),(-9.75,s*.73,.64),(-8.95,s*.9,.65),(-9.25,s*.91,.35),(-9.95,s*.66,.26)],[(0,1,2,3,4)],glass)
 bpy.ops.object.text_add(location=(-5.8,s*1.125,.02))
 ob=bpy.context.object;ob.name='AERE wordmark';ob.data.body='A E R E';ob.data.size=.48;ob.data.extrude=.001;ob.rotation_euler=(math.pi/2 if s==-1 else math.pi/2,0,0 if s==-1 else math.pi);ob.data.materials.append(navy)
panel('Vertical tail',[(6.3,0,.8),(8.4,0,4.5),(9.45,0,4.65),(10.3,0,.4)],.19,navy)
for s in [-1,1]:
 mesh('Champagne tail slash',[(7.7,s*.105,1.7),(8.55,s*.105,3.55),(8.85,s*.105,3.58),(8.3,s*.105,1.7)],[(0,1,2,3)],copper)
# Export only this studio scene; optimized smooth geometry, no lights in the GLB.
os.makedirs(ROOT+'/public/models',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/aere-aircraft.glb',use_active_scene=True,export_apply=True)
world=bpy.data.worlds.new('Atmospheric studio');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.18,.27,.37,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.5;scene.world=world
for name,loc,power,size in [('Sunlit softbox',(-8,-10,16),2500,12),('Rim softbox',(6,8,9),1800,10)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-19,-26,13));camera=bpy.context.object;camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=46;scene.camera=camera
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets-source/aere-aircraft.blend')
print('Saved editable aircraft and GLB',len(scene.objects))
