import trimesh, numpy as np, sys
D="/home/claude/assets/nasa/3D Printing/SOFIA/"
parts=['Nose section','Fuselage top','Tail section','Left wing','Right wing','Telescope cavity closed']
ms=[trimesh.load(D+p+'.stl') for p in parts]
m=trimesh.util.concatenate(ms)
m.merge_vertices(digits_vertex=2)
print('faces',len(m.faces),'bounds',m.bounds)
# to metres: real 747SP length 56.3m
L=m.bounds[1][0]-m.bounds[0][0]; s=56.3/L
m.apply_scale(s)
# three.js: nose toward -Z? use x forward(+x = nose), y up, z span
R=np.array([[-1,0,0,0],[0,0,1,0],[0,1,0,0],[0,0,0,1]],float)  # x->-x (nose +x), z->y up, y->z
m.apply_transform(R)
if np.linalg.det(R[:3,:3])<0: m.invert()
c=m.bounds.mean(0); m.apply_translation([-c[0],-m.bounds[0][1],-c[2]])
print('scaled bounds',m.bounds)
m.export('/home/claude/pkg/b747.glb')
