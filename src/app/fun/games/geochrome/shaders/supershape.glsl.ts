export const supershapeVertex = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uQuality;

  attribute vec4 aShapeParams;
  attribute vec3 aInstanceColor;
  attribute float aItemScale;

  varying vec3 vColor;
  varying float vRim;
  varying float vPulse;

  const float PI = 3.141592653589793;

  float superformula(float angle, float m, float n1, float n2, float n3) {
    float a = 1.0;
    float b = 1.0;

    float p1 = pow(abs(cos(m * angle * 0.25) / a), n2);
    float p2 = pow(abs(sin(m * angle * 0.25) / b), n3);

    float inside = max(0.0001, p1 + p2);
    float r = pow(inside, -1.0 / max(0.5, n1));
    return clamp(r, 0.72, 1.28);
  }

  void main() {
    vColor = aInstanceColor;

    vec3 unitPos = normalize(position);
    float theta = atan(unitPos.z, unitPos.x);
    float phi = asin(clamp(unitPos.y, -1.0, 1.0));

    float m = aShapeParams.x;
    float n1 = aShapeParams.y;
    float n2 = aShapeParams.z;
    float n3 = aShapeParams.w;

    float r1 = superformula(theta, m, n1, n2, n3);
    float r2 = superformula(phi, m + 0.5, n1 + 0.2, n2, n3 + 0.1);

    float shapeRadius = clamp(r1 * r2, 0.76, 1.24);
    float q = clamp(uQuality, 0.0, 1.0);
    float radius = mix(1.0, shapeRadius, q);

    float pulse = 0.97 + 0.03 * sin(uTime * 0.8 + m * 0.2);
    vec3 supershapePos = unitPos * radius * aItemScale * pulse;

    vec3 transformed = supershapePos;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    vec3 worldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normalize(supershapePos));
    vec3 viewDir = normalize(-mvPosition.xyz);
    vRim = pow(1.0 - abs(dot(viewDir, worldNormal)), 2.0);
    vPulse = pulse;
  }
`;

export const supershapeFragment = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vRim;
  varying float vPulse;

  void main() {
    vec3 base = vColor;
    vec3 glossy = mix(base * 0.74, base * 1.18, vRim);
    vec3 glow = vec3(0.25, 0.3, 0.42) * vRim;
    float alpha = 1.0;
    vec3 finalColor = glossy + glow + vec3(0.05 * vPulse);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
