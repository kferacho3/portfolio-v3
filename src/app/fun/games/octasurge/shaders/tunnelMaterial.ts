import * as THREE from 'three';

export const createTunnelMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 5.0 },
      uSpacing: { value: 0.82 },
      uScroll: { value: 0 },
      uSpeed: { value: 0 },
      uAudioReactive: { value: 0 },
      uCombo: { value: 0 },
      uVariant: { value: 0 },
      uStageFlash: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      attribute float aLane;
      attribute float aRing;
      attribute float aSides;
      attribute float aActive;
      attribute float aStage;
      attribute float aHazard;
      attribute float aPlatform;

      uniform float uRadius;
      uniform float uSpacing;
      uniform float uScroll;

      varying vec2 vUv;
      varying float vActive;
      varying float vStage;
      varying float vHazard;
      varying float vPlatform;
      varying float vDepth;

      const float TAU = 6.283185307179586;

      void main() {
        vUv = uv;
        vActive = aActive;
        vStage = aStage;
        vHazard = aHazard;
        vPlatform = aPlatform;

        float sides = max(aSides, 3.0);
        float lane = mod(aLane, sides);
        float ang = (lane / sides) * TAU;

        vec3 nOut = vec3(cos(ang), sin(ang), 0.0);
        vec3 nIn = -nOut;
        vec3 tangent = vec3(-sin(ang), cos(ang), 0.0);
        vec3 forward = vec3(0.0, 0.0, 1.0);

        float z = -aRing * uSpacing + uScroll;
        vec3 base = nOut * uRadius + vec3(0.0, 0.0, z);

        float visible = step(0.5, aActive);
        vec3 local = position;
        local.y *= mix(0.02, 1.0, visible);
        local.z *= mix(0.04, 1.0, visible);

        vec3 worldPos = base
          + tangent * local.x
          + nIn * local.y
          + forward * local.z;

        vDepth = -z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      varying float vActive;
      varying float vStage;
      varying float vHazard;
      varying float vPlatform;
      varying float vDepth;

      uniform float uTime;
      uniform float uSpeed;
      uniform float uAudioReactive;
      uniform float uCombo;
      uniform float uVariant;
      uniform float uStageFlash;

      vec3 palette(float t) {
        vec3 a = vec3(0.09, 0.10, 0.14);
        vec3 b = vec3(0.42, 0.30, 0.58);
        vec3 c = vec3(0.95, 0.98, 1.0);
        vec3 d = vec3(0.00, 0.20, 0.40);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec2 gridUv = vUv * vec2(6.0, 2.4);
        vec2 grid = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);

        float pulse = sin(vDepth * 0.20 + uTime * (1.7 + uSpeed * 0.08)) * 0.5 + 0.5;
        pulse += uAudioReactive * 0.65;
        pulse += smoothstep(0.0, 24.0, uCombo) * 0.4;

        float stageShift = vStage * 0.42 + uVariant * 0.14;
        vec3 tone = palette(fract(stageShift + uTime * 0.03 + vDepth * 0.015));

        vec3 base = vec3(0.02, 0.02, 0.03);
        vec3 laneGlow = tone * pow(line, 2.0) * pulse;

        vec3 hazardCol = vec3(1.0, 0.44, 0.28) * (0.35 + pulse * 0.85) * vHazard;
        vec3 platformCol = vec3(0.43, 0.94, 1.0) * (0.22 + pulse * 0.58) * vPlatform;

        float flash = uStageFlash * 0.35;
        vec3 finalCol = base + laneGlow + hazardCol + platformCol + tone * flash;
        finalCol *= mix(0.36, 1.0, step(0.5, vActive));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
