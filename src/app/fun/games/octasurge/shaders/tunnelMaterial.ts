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
      varying float vLaneNorm;

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

        // Keep holes present as tiny beveled slivers so silhouettes stay readable.
        local.y *= mix(0.012, 1.0, visible);
        local.z *= mix(0.02, 1.0, visible);

        vec3 worldPos = base
          + tangent * local.x
          + nIn * local.y
          + forward * local.z;

        vDepth = -z;
        vLaneNorm = lane / sides;
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
      varying float vLaneNorm;

      uniform float uTime;
      uniform float uSpeed;
      uniform float uAudioReactive;
      uniform float uCombo;
      uniform float uVariant;
      uniform float uStageFlash;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 34.45);
        return fract(p.x * p.y);
      }

      vec3 palette(float t) {
        vec3 a = vec3(0.07, 0.09, 0.14);
        vec3 b = vec3(0.36, 0.28, 0.58);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.24, 0.62);
        return a + b * cos(6.28318 * (c * t + d));
      }

      vec3 variantPattern(float variant, vec2 uv, float depth, float pulse, vec3 tone) {
        vec3 col = vec3(0.0);

        if (variant < 0.5) {
          vec2 gUv = uv * vec2(7.2, 2.6);
          vec2 g = abs(fract(gUv - 0.5) - 0.5) / fwidth(gUv);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float rail = 1.0 - smoothstep(0.02, 0.11, abs(uv.x - 0.5));
          col += tone * (pow(line, 2.2) * 0.9 + rail * 0.35) * pulse;
        } else if (variant < 1.5) {
          vec2 gUv = uv * vec2(8.0, 2.0);
          float seam = smoothstep(0.44, 0.5, max(abs(fract(gUv.x) - 0.5), abs(fract(gUv.y) - 0.5)));
          float brush = 0.5 + 0.5 * sin(uv.y * 48.0 + depth * 0.08 + uTime * 0.3);
          col += tone * (seam * 0.9 + brush * 0.45) * pulse;
        } else if (variant < 2.5) {
          vec2 gUv = uv * 6.2;
          float facet = smoothstep(0.18, 0.42, abs(fract(gUv.x + gUv.y) - 0.5));
          float lattice = smoothstep(0.42, 0.5, max(abs(fract(gUv.x) - 0.5), abs(fract(gUv.y) - 0.5)));
          col += tone * (facet * 0.9 + lattice * 0.6) * pulse;
        } else if (variant < 3.5) {
          vec2 gUv = uv * vec2(2.2, 7.0);
          float row = floor(gUv.y);
          float flip = step(0.5, mod(row, 2.0));
          vec2 fUv = fract(gUv);
          fUv.x = mix(fUv.x, 1.0 - fUv.x, flip);
          float chevron = smoothstep(0.5, 0.18, abs(fUv.x - 0.5) + abs(fUv.y - 0.5));
          float center = 1.0 - smoothstep(0.16, 0.42, abs(uv.x - 0.5));
          col += tone * chevron * center * (0.6 + pulse * 0.7);
        } else if (variant < 4.5) {
          vec2 gUv = uv * 7.0;
          vec2 cell = abs(fract(gUv) - 0.5);
          float grid = smoothstep(0.42, 0.5, max(cell.x, cell.y));
          float inset = smoothstep(0.1, 0.36, min(cell.x, cell.y));
          col += tone * (grid * 0.95 + inset * 0.65) * pulse;
        } else if (variant < 5.5) {
          vec2 dUv = fract(uv * 4.0) - 0.5;
          float diamond = 1.0 - smoothstep(0.28, 0.45, abs(dUv.x) + abs(dUv.y));
          float frame = smoothstep(0.46, 0.5, max(abs(dUv.x), abs(dUv.y)));
          col += tone * (diamond * 0.8 + frame * 0.45) * pulse;
        } else if (variant < 6.5) {
          vec2 sUv = uv * 4.0;
          float stairs = floor((sUv.x + sUv.y) * 1.3) / 4.0;
          float ridge = smoothstep(0.45, 0.5, abs(fract((sUv.x + sUv.y) * 2.2) - 0.5));
          col += tone * (0.35 + stairs * 0.6 + ridge * 0.5) * pulse;
        } else {
          vec2 wUv = uv - 0.5;
          float d = length(wUv);
          float ripple = 0.5 + 0.5 * sin(d * 28.0 - depth * 0.16 - uTime * 1.15);
          float rings = smoothstep(0.32, 0.92, ripple);
          col += tone * (rings * 0.9 + ripple * 0.35) * pulse;
        }

        return col;
      }

      void main() {
        float speedPulse = sin(vDepth * 0.18 + uTime * (1.6 + uSpeed * 0.08)) * 0.5 + 0.5;
        float comboPulse = smoothstep(0.0, 24.0, uCombo) * 0.42;
        float audioPulse = uAudioReactive * 0.66;
        float pulse = 0.42 + speedPulse * 0.58 + comboPulse + audioPulse;

        float stageShift = vStage * 0.38 + vLaneNorm * 0.12;
        vec3 tone = palette(fract(stageShift + uTime * 0.025 + vDepth * 0.014));

        float variant = floor(uVariant + 0.5);
        vec3 base = vec3(0.014, 0.015, 0.02);
        vec3 tile = variantPattern(variant, vUv, vDepth, pulse, tone);

        float hazardPulse =
          (0.4 + 0.6 * sin(vDepth * 0.24 + uTime * 3.2 + vHazard * 14.0)) *
          smoothstep(0.02, 1.0, vHazard);
        vec3 hazardCol = vec3(1.0, 0.33, 0.21) * hazardPulse * (0.55 + uAudioReactive * 0.75);

        float platformPulse =
          (0.48 + 0.52 * sin(vDepth * 0.16 + uTime * 2.1 + vPlatform * 11.0)) *
          smoothstep(0.02, 1.0, vPlatform);
        vec3 platformCol = vec3(0.32, 0.9, 1.0) * platformPulse * 0.7;

        float noise = hash21(vUv + vec2(vDepth * 0.01, uTime * 0.01)) * 0.025;
        float flash = uStageFlash * 0.28;

        vec3 finalCol = base + tile + hazardCol + platformCol + tone * flash + noise;
        finalCol *= mix(0.3, 1.0, step(0.5, vActive));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
