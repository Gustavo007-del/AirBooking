"""Surgical cockpit-only edit of the currently open aircraft source."""
import bpy, math, hashlib, json, contextlib, io
from mathutils import Vector
ROOT=r'C:\Users\91906\Desktop\Airbooking\aere'
scene=bpy.context.scene
def cockpit(o): return o.name.startswith(('Cockpit window frame','Cockpit glass pane'))
def fingerprint():
 records=[]
 for o in scene.objects:
  if cockpit(o):continue
  item=[o.name,o.type,list(map(list,o.matrix_world))]
  if o.type=='MESH':
   item += [[tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],[(m.name,[(n.type,[(s.name,str(s.default_value)) for s in n.inputs if hasattr(s,'default_value')]) for n in m.node_tree.nodes]) for m in o.data.materials if m and m.use_nodes]]
  records.append(item)
 return hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest()
before=fingerprint()
body=next(o for o in scene.objects if o.name.startswith('Sculpted fuselage'))
surface=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
glass=bpy.data.materials.new('Cockpit only — blue grey laminated glass');glass.use_nodes=True
p=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for key,val in [('Base Color',(.035,.065,.085,1)),('Metallic',.04),('Roughness',.24),('IOR',1.46),('Transmission Weight',.05),('Coat Weight',.28),('Coat Roughness',.035)]:p.inputs[key].default_value=val
frame=bpy.data.materials.new('Cockpit only — narrow rubber seal');frame.use_nodes=True
seal=next(n for n in frame.node_tree.nodes if n.type=='BSDF_PRINCIPLED');seal.inputs['Base Color'].default_value=(.028,.034,.038,1);seal.inputs['Roughness'].default_value=.65
panes=[
 [(-10.18,1.535),(-9.70,1.535),(-9.10,.85),(-9.70,.67)],
 [(-9.63,.64),(-9.04,.81),(-8.66,.65),(-8.76,.32)],
 [(-8.69,.32),(-8.60,.64),(-8.29,.56),(-8.30,.30)],
]
def rounded_boundary(corners):
 c=[Vector(v) for v in corners];out=[]
 for i,point in enumerate(c):
  start=point.lerp(c[(i-1)%4],.035);end=point.lerp(c[(i+1)%4],.035)
  for j in range(7):
   t=j/6;out.append((1-t)**2*start+2*(1-t)*t*point+t*t*end)
   next_start=c[(i+1)%4].lerp(point,.035)
  for j in range(1,13):out.append(end.lerp(next_start,j/13))
 return out
def project(point,side,offset):
 x,angle=point;direction=Vector((0,side*math.cos(angle),math.sin(angle)))
 hit,loc,normal,_=surface.ray_cast(Vector((x,0,0))+direction*4,-direction)
 if not hit:raise RuntimeError('Windshield projection failed')
 return loc+normal*offset
for side in [-1,1]:
 for index,corners in enumerate(panes):
  outline=rounded_boundary(corners);center=sum(outline,Vector((0,0)))/len(outline)
  for prefix,material,shrink,offset in [('Cockpit window frame',frame,1,.006),('Cockpit glass pane',glass,.981,.011)]:
   candidates=[o for o in scene.objects if o.name.startswith(prefix+' '+str(index+1))]
   obj=next(o for o in candidates if sum(v.co.y for v in o.data.vertices)*side>0)
   boundary=[center+(v-center)*shrink for v in outline];count=len(boundary);rings=24
   verts=[project(center,side,offset)]
   for r in range(1,rings+1):
    for point in boundary:verts.append(project(center.lerp(point,r/rings),side,offset))
   faces=[(0,1+j,1+(j+1)%count) for j in range(count)]
   for r in range(rings-1):
    a=1+r*count;b=a+count
    faces += [(a+j,b+j,b+(j+1)%count,a+(j+1)%count) for j in range(count)]
   # Outward normals follow the unchanged fuselage normal on each side.
   a,b,c=[verts[i] for i in faces[0]]
   if (b-a).cross(c-a).dot(Vector((0,side,1)))<0:faces=[tuple(reversed(f)) for f in faces]
   data=bpy.data.meshes.new(prefix+' aerodynamic surface');data.from_pydata(verts,[],faces);data.update()
   for face in data.polygons:face.use_smooth=True
   obj.data=data;data.materials.append(material)
assert fingerprint()==before,'Non-cockpit scene data changed'
bpy.data.libraries.write(ROOT+'/assets-source/aere-aircraft.blend',{scene},fake_user=True,compress=True)
with contextlib.redirect_stdout(io.StringIO()):
 bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/aere-aircraft.glb',use_active_scene=True,export_apply=True,export_cameras=False,export_lights=False)
print('Updated 6 cockpit panes and 6 flush surrounds. Non-cockpit geometry, transforms, and material nodes verified identical. Source and existing website GLB saved.')


