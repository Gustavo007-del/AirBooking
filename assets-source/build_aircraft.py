import bpy, math, os
from mathutils import Vector
ROOT = r'C:\Users\91906\Desktop\Airbooking\aere'
# Separate scene preserves any work already open in Blender.
scene = bpy.data.scenes.new('Air Booking Aircraft — refined nose and mounts')
bpy.context.window.scene = scene
def mat(name,color,metal=0,rough=.35):
 m=bpy.data.materials.new(name); m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
ivory=mat('Pearl ceramic fuselage',(.82,.86,.88),.18,.34)
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
# A lowered radome tip flows into a fuller cockpit crown, avoiding a pointed cone.
profile=[(-11.15,.012,-.20),(-11.08,.18,-.19),(-10.9,.36,-.17),(-10.65,.52,-.13),(-10.3,.69,-.08),(-9.9,.84,-.035),(-9.45,.96,0),(-8.9,1.055,0),(-8.2,1.10,0),(-6,1.12,0),(4.9,1.12,0),(6.7,.98,.02),(8,.72,.08),(9.5,.4,.17),(10.8,.08,.25),(11,.002,.26)]
segments=96
verts=[(x,r*math.cos(math.tau*j/segments),zc+r*math.sin(math.tau*j/segments)) for x,r,zc in profile for j in range(segments)]
faces=[(i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j) for i in range(len(profile)-1) for j in range(segments)]
faces += [tuple(range(segments-1,-1,-1)),tuple((len(profile)-1)*segments+j for j in range(segments))]
body=mesh('Sculpted fuselage',verts,faces,ivory)
sub=body.modifiers.new('Continuous fuselage surface','SUBSURF');sub.levels=2;sub.render_levels=2
bpy.context.view_layer.update()
evaluated_body=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
def surface_point(x,angle,side,offset=.008):
 direction=Vector((0,side*math.cos(angle),math.sin(angle)))
 hit,location,normal,_=evaluated_body.ray_cast(Vector((x,0,0))+direction*4,-direction)
 if not hit: raise RuntimeError('Unable to project cockpit glazing onto fuselage')
 return tuple(location+normal*offset)
def glazing_patch(name,corners,side,material,offset,inset=0):
 # Subdivided, surface-projected panes cannot float above or cut through the nose.
 resolution=8;vertices=[]
 for j in range(resolution+1):
  v=inset+(1-2*inset)*j/resolution
  for i in range(resolution+1):
   u=inset+(1-2*inset)*i/resolution
   point=(1-u)*(1-v)*Vector(corners[0])+u*(1-v)*Vector(corners[1])+u*v*Vector(corners[2])+(1-u)*v*Vector(corners[3])
   vertices.append(surface_point(point.x,point.y,side,offset))
 quads=[(j*(resolution+1)+i,j*(resolution+1)+i+1,(j+1)*(resolution+1)+i+1,(j+1)*(resolution+1)+i) for j in range(resolution) for i in range(resolution)]
 ob=mesh(name,vertices,quads,material)
 # Glazing is explicitly double-sided in its glTF material.
 return ob
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
 ey=s*3.65;ez=-1.13;engine_shift=1.10
 # Thick swept pylons overlap BOTH the wing volume and the nacelle crown.
 section=[(-.55,-.02),(1.25,-.02),(.55,-.54),(-.95,-.70)]
 pv=[(x,ey+dy,z) for dy in [-.16,.16] for x,z in section]
 pylon=mesh('Structural engine-to-wing pylon',pv,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],ivory)
 bevel=pylon.modifiers.new('Pylon edge fillets','BEVEL');bevel.width=.07;bevel.segments=3
 def engine_lathe(name,points,material):
  return lathe(name,[(x+engine_shift,r) for x,r in points],material,ey,ez)
 engine_lathe('Turbofan nacelle',[(-3.3,.68),(-3.2,.8),(-2.9,.85),(-1.6,.83),(-.6,.65),(-.5,.48)],ivory)
 engine_lathe('Polished inlet rim',[(-3.3,.68),(-3.34,.71),(-3.31,.77),(-3.2,.8)],metal)
 engine_lathe('Dark intake tunnel',[(-3.31,.68),(-2.75,.61)],dark)
 engine_lathe('Engine spinner',[(-3.15,.02),(-3,.18),(-2.8,.22)],metal)
 for j in range(24):
  a=j*math.tau/24
  mesh('Fan blade', [(-2.88+engine_shift,ey+.18*math.cos(a),ez+.18*math.sin(a)),(-2.83+engine_shift,ey+.63*math.cos(a+.15),ez+.63*math.sin(a+.15)),(-2.77+engine_shift,ey+.62*math.cos(a+.28),ez+.62*math.sin(a+.28)),(-2.8+engine_shift,ey+.21*math.cos(a+.25),ez+.21*math.sin(a+.25))],[(0,1,2,3)],metal)
 for i in range(43):
  x=-7.6+i*.30
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(x,s*1.067,.30))
  ob=bpy.context.object;ob.name='Cabin window';ob.scale=(.086,.027,.13);ob.data.materials.append(glass)
 for x in [-7.9,-.3,5.7]:
  panel('Door outline',[(x,s*1.098,-.35),(x+.35,s*1.098,-.35),(x+.35,s*1.098,.68),(x,s*1.098,.68)],.02,metal)
  panel('Door panel',[(x+.025,s*1.115,-.32),(x+.325,s*1.115,-.32),(x+.325,s*1.115,.65),(x+.025,s*1.115,.65)],.02,ivory)
 cockpit_panes=[
  [(-10.12,.60),(-9.78,1.44),(-9.29,1.30),(-9.43,.48)],
  [(-9.36,.47),(-9.22,1.24),(-8.78,.90),(-8.82,.40)],
  [(-8.75,.40),(-8.70,.88),(-8.36,.69),(-8.38,.37)],
 ]
 for index,corners in enumerate(cockpit_panes):
  glazing_patch('Cockpit window frame '+str(index+1),corners,s,metal,.012)
  glazing_patch('Cockpit glass pane '+str(index+1),corners,s,glass,.021,.075)
 # Centre-aligned text reads correctly on both sides and sits below the window row.
 bpy.ops.object.text_add(location=(-4.55,s*1.10,-.33))
 ob=bpy.context.object;ob.name='Air Booking fuselage wordmark';ob.data.body='Air Booking';ob.data.align_x='CENTER';ob.data.size=.40;ob.data.space_character=1.08;ob.data.extrude=.001
 ob.rotation_euler=(math.pi/2,0,0 if s==-1 else math.pi)
 ob.data.materials.append(navy)
 # Project each text vertex onto the fuselage to avoid hovering over the curved skin.
 bpy.ops.object.convert(target='MESH')
 lettering=bpy.context.object;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 for v in lettering.data.vertices:
  world=lettering.matrix_world@v.co
  hit,loc,normal,_=evaluated_body.ray_cast(Vector((world.x,s*4,world.z)),Vector((0,-s,0)))
  if hit:v.co=lettering.matrix_world.inverted()@(loc+normal*.012)
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
bpy.data.libraries.write(ROOT+'/assets-source/aere-aircraft.blend',{scene},fake_user=True,compress=True)
print('Saved editable aircraft and GLB',len(scene.objects))
