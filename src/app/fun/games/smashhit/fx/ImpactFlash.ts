import * as THREE from 'three';

export function updateImpactFlash(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  x: number,
  y: number,
  z: number,
  alpha: number
) {
  mesh.visible = alpha > 0.001;
  mesh.position.set(x, y, z);
  mesh.quaternion.copy(camera.quaternion);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = alpha;
}
