import * as THREE from 'three';

export const createTunnelMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 4.75 },
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
        local.y *= mix(0.008, 1.0, visible);
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
        vec3 a = vec3(0.06, 0.08, 0.12);
        vec3 b = vec3(0.35, 0.28, 0.58);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.24, 0.62);
        return a + b * cos(6.28318 * (c * t + d));
      }

      vec3 variantPattern(float variant, vec2 uv, float depth, float pulse, vec3 tone) {
        vec3 col = vec3(0.0);

        if (variant < 0.5) {
          vec2 gUv = uv * vec2(7.6, 2.8);
          vec2 g = abs(fract(gUv - 0.5) - 0.5) / fwidth(gUv);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float rail = 1.0 - smoothstep(0.02, 0.11, abs(uv.x - 0.5));
          col += tone * (pow(line, 2.1) * 0.9 + rail * 0.38) * pulse;
        } else if (variant < 1.5) {
          // Alloy: brushed metallic channels and seams.
          vec2 gUv = uv * vec2(8.0, 2.0);
          float seam = smoothstep(0.44, 0.5, max(abs(fract(gUv.x) - 0.5), abs(fract(gUv.y) - 0.5)));
          float brushed = 0.5 + 0.5 * sin(uv.y * 44.0 + depth * 0.07 + uTime * 0.22);
          float plate = smoothstep(0.15, 0.42, abs(fract(gUv.x * 0.5) - 0.5));
          col += tone * (seam * 0.95 + brushed * 0.48 + plate * 0.35) * pulse;
        } else if (variant < 2.5) {
          // Prismatic: faceted triangles with shifting highlights.
          vec2 pUv = uv * 6.2;
          float tri = abs(fract(pUv.x + pUv.y) - 0.5);
          float facet = 1.0 - smoothstep(0.12, 0.45, tri);
          float edge = smoothstep(0.43, 0.5, max(abs(fract(pUv.x) - 0.5), abs(fract(pUv.y) - 0.5)));
          float sheen = 0.5 + 0.5 * sin((uv.x + uv.y) * 16.0 + depth * 0.11 + uTime * 1.1);
          col += tone * (facet * 0.95 + edge * 0.65 + sheen * 0.38) * pulse;
        } else if (variant < 3.5) {
          // GridForge: forged grid lattice with hot cores.
          vec2 gUv = uv * 7.2;
          vec2 cell = abs(fract(gUv) - 0.5);
          float frame = smoothstep(0.42, 0.5, max(cell.x, cell.y));
          float core = 1.0 - smoothstep(0.08, 0.3, max(cell.x, cell.y));
          float forge = 0.5 + 0.5 * sin((cell.x + cell.y) * 38.0 + depth * 0.08 + uTime * 0.7);
          col += tone * (frame * 1.05 + core * 0.35 + forge * 0.45) * pulse;
        } else if (variant < 4.5) {
          // Diamond Tess: repeating diamond tiling.
          vec2 dUv = fract(uv * 4.4) - 0.5;
          float diamond = 1.0 - smoothstep(0.24, 0.46, abs(dUv.x) + abs(dUv.y));
          float frame = smoothstep(0.45, 0.5, max(abs(dUv.x), abs(dUv.y)));
          float spark = 0.5 + 0.5 * sin((dUv.x - dUv.y) * 36.0 + depth * 0.09 + uTime * 1.4);
          col += tone * (diamond * 0.9 + frame * 0.52 + spark * 0.32) * pulse;
        } else if (variant < 5.5) {
          // Sunken Steps: stepped terrace grooves.
          vec2 sUv = uv * vec2(6.0, 3.8);
          float stair = floor((sUv.x + sUv.y * 0.8) * 1.1) / 7.0;
          float ridge = smoothstep(0.46, 0.5, abs(fract((sUv.x + sUv.y) * 2.4) - 0.5));
          float recess = 1.0 - smoothstep(0.1, 0.42, abs(fract(sUv.y) - 0.5));
          col += tone * (0.26 + stair * 0.7 + ridge * 0.5 + recess * 0.25) * pulse;
        } else {
          // Ripple: radial waterline ripples.
          vec2 wUv = uv - 0.5;
          float d = length(wUv);
          float ripple = 0.5 + 0.5 * sin(d * 30.0 - depth * 0.16 - uTime * 1.2);
          float rings = smoothstep(0.3, 0.92, ripple);
          float crest = smoothstep(0.7, 1.0, ripple);
          col += tone * (rings * 0.88 + crest * 0.5 + ripple * 0.2) * pulse;
        }

        return col;
      }

      void main() {
        float speedPulse = sin(vDepth * 0.17 + uTime * (1.4 + uSpeed * 0.08)) * 0.5 + 0.5;
        float comboPulse = smoothstep(0.0, 24.0, uCombo) * 0.44;
        float audioPulse = uAudioReactive * 0.58;
        float pulse = 0.4 + speedPulse * 0.6 + comboPulse + audioPulse;

        float stageShift = vStage * 0.38 + vLaneNorm * 0.14;
        vec3 tone = palette(fract(stageShift + uTime * 0.03 + vDepth * 0.012));

        float variant = floor(uVariant + 0.5);
        vec3 base = vec3(0.013, 0.015, 0.021);
        vec3 tile = variantPattern(variant, vUv, vDepth, pulse, tone);

        float hazardBand = 1.0 - smoothstep(0.12, 0.48, abs(vUv.x - 0.5));
        float hazardPulse =
          (0.35 + 0.65 * sin(vDepth * 0.22 + uTime * 3.4 + vHazard * 11.0)) *
          smoothstep(0.02, 1.0, vHazard);
        vec3 hazardCol = vec3(1.0, 0.31, 0.2) * hazardPulse * (0.55 + hazardBand * 0.42);

        float platformChevron = smoothstep(0.54, 0.24, abs(vUv.x - 0.5) + abs(vUv.y - 0.5));
        float platformPulse =
          (0.46 + 0.54 * sin(vDepth * 0.15 + uTime * 2.2 + vPlatform * 9.0)) *
          smoothstep(0.02, 1.0, vPlatform);
        vec3 platformCol = vec3(0.3, 0.92, 1.0) * platformPulse * (0.55 + platformChevron * 0.45);

        float noise = hash21(vUv + vec2(vDepth * 0.01, uTime * 0.01)) * 0.02;
        float flash = uStageFlash * 0.3;

        vec3 finalCol = base + tile + hazardCol + platformCol + tone * flash + noise;
        finalCol *= mix(0.27, 1.0, step(0.5, vActive));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
