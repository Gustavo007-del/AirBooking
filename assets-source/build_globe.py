import bpy, math, os
from mathutils import Vector
ROOT=r'C:\Users\91906\Desktop\Airbooking\aere'
scene=bpy.data.scenes.new('AERE World Connections')
bpy.context.window.scene=scene
bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=48,radius=3.8)
earth=bpy.context.object;earth.name='Earth — editable geographic globe'
for p in earth.data.polygons:p.use_smooth=True
mat=bpy.data.materials.new('Blue Marble earth');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(ROOT+'/public/textures/earth.jpg');tex.image.pack()
mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.85;earth.data.materials.append(mat)
routeMat=bpy.data.materials.new('Champagne connections');routeMat.use_nodes=True
p=next(n for n in routeMat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.68,.45,.23,1);p.inputs['Metallic'].default_value=.4
for idx,points in enumerate([[(.7,2.3,3.1),(3,4,3),(3.6,.5,.9)],[(-2,2,2.8),(0,4.8,4),(3.6,.5,.9)],[(3.6,.5,.9),(4,-1,3),(1.2,-2,3.1)]]):
 a,b,c=[Vector(p) for p in points]
 curve=bpy.data.curves.new('Illustrative route','CURVE');curve.dimensions='3D';curve.bevel_depth=.013;curve.bevel_resolution=3
 spline=curve.splines.new('POLY');spline.points.add(48)
 for i,pt in enumerate(spline.points):
  t=i/48;v=(1-t)**2*a+2*(1-t)*t*b+t*t*c;pt.co=(*v,1)
 obj=bpy.data.objects.new('Route '+str(idx+1),curve);scene.collection.objects.link(obj);obj.data.materials.append(routeMat)
world=bpy.data.worlds.new('Midnight environment');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.025,.06,.09,1);scene.world=world
bpy.ops.object.light_add(type='AREA',location=(0,-7,9));bpy.context.object.data.energy=1200;bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(0,-13,4));cam=bpy.context.object;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets-source/aere-world.blend')
print('Saved editable geographic globe with packed texture and routes')
