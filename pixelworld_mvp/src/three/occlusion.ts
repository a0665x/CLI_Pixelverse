import * as T from 'three';
/** Bounds are authored before material batching, so a query never scans decorative triangles. */
export function occlusionBounds(root:T.Object3D):T.Box3[]{
 const bounds:T.Box3[]=[];root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
 root.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh)return;
  o.geometry.computeBoundingBox();const box=o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
  if(box.max.y>.6&&box.max.y-box.min.y>.08)bounds.push(box);
 });return bounds;
}
const cached=new WeakMap<T.Object3D,T.Box3[]>();
const hit=new T.Vector3(),localRay=new T.Ray(),inverse=new T.Matrix4();
export function viewOccluded(root:T.Object3D,ray:T.Raycaster):boolean {
 if(!root.visible)return false;
 const boxes=root.userData.occlusionBounds as T.Box3[]|undefined;
 if(boxes||root instanceof T.Mesh){
  let list=boxes??cached.get(root);if(!list){list=occlusionBounds(root);cached.set(root,list);}
  inverse.copy(root.matrixWorld).invert();localRay.copy(ray.ray).applyMatrix4(inverse);
  for(const box of list){if(box.containsPoint(localRay.origin))return true;if(localRay.intersectBox(box,hit)){hit.applyMatrix4(root.matrixWorld);const d=hit.distanceTo(ray.ray.origin);if(d>=ray.near&&d<ray.far)return true;}}
  return false;
 }
 return root.children.some(child=>viewOccluded(child,ray));
}
