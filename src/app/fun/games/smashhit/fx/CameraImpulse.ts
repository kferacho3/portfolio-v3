import * as THREE from 'three';

export class CameraImpulse {
  private velocity = new THREE.Vector3();
  private offset = new THREE.Vector3();

  applyImpulse(direction: THREE.Vector3, strength: number) {
    const lenSq = direction.lengthSq();
    if (lenSq <= 1e-6) return;
    const invLen = 1 / Math.sqrt(lenSq);
    this.velocity.addScaledVector(direction, strength * invLen);
  }

  update(delta: number, damping = 8, stiffness = 120) {
    const accel = this.offset.clone().multiplyScalar(-stiffness);
    this.velocity.addScaledVector(accel, delta);
    this.velocity.multiplyScalar(Math.exp(-damping * delta));
    this.offset.addScaledVector(this.velocity, delta);
    return this.offset;
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.offset.set(0, 0, 0);
  }
}
