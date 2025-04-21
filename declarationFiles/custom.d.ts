// custom.d.ts
declare module 'three/examples/jsm/postprocessing/EffectComposer' {
  import * as THREE from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass';

  export class EffectComposer {
    constructor(
      renderer: THREE.WebGLRenderer,
      renderTarget?: THREE.WebGLRenderTarget
    );
    addPass(pass: Pass): void;
    render(delta?: number): void;
    setSize(width: number, height: number): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/postprocessing/RenderPass' {
  import * as THREE from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass';

  export class RenderPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera);
    render(
      renderer: THREE.WebGLRenderer,
      writeBuffer: THREE.WebGLRenderTarget,
      readBuffer: THREE.WebGLRenderTarget,
      delta: number,
      maskActive: boolean
    ): void;
  }
}

declare module 'three/examples/jsm/postprocessing/OutlinePass' {
  import * as THREE from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass';

  export class OutlinePass extends Pass {
    constructor(
      resolution: THREE.Vector2,
      scene: THREE.Scene,
      camera: THREE.Camera
    );
    selectedObjects: THREE.Object3D[];
    edgeStrength: number;
    edgeThickness: number;
    edgeGlow: number;
    pulsePeriod: number;
    visibleEdgeColor: THREE.Color;
    hiddenEdgeColor: THREE.Color;
    renderToScreen: boolean;
  }
}

declare module 'three/examples/jsm/postprocessing/ShaderPass' {
  import * as THREE from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass';

  export class ShaderPass extends Pass {
    constructor(shader: any, textureID?: string);
    uniforms: { [key: string]: THREE.IUniform };
    material: THREE.ShaderMaterial;
    render(
      renderer: THREE.WebGLRenderer,
      writeBuffer: THREE.WebGLRenderTarget,
      readBuffer: THREE.WebGLRenderTarget,
      delta: number,
      maskActive: boolean
    ): void;
  }
}

declare module 'three/examples/jsm/shaders/FXAAShader' {
  import * as THREE from 'three';

  export const FXAAShader: {
    uniforms: {
      resolution: { value: THREE.Vector2 };
    };
    vertexShader: string;
    fragmentShader: string;
  };
}
