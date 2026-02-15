export const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aEnergy;
  attribute float aIsWhale;

  varying vec3 vColor;
  varying float vOpacity;
  varying float vEnergy;
  varying float vIsWhale;

  uniform float uPixelRatio;
  uniform float uTime;

  void main() {
    vColor = color;
    vOpacity = aOpacity;
    vEnergy = aEnergy;
    vIsWhale = aIsWhale;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const particleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;
  varying float vEnergy;
  varying float vIsWhale;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center) * 2.0;

    if (dist > 1.0) discard;

    // Smooth radial falloff with energy-dependent sharpness
    // High energy → sharper, more defined core; low energy → softer, diffused
    float sharpness = 1.2 + vEnergy * 0.5;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, sharpness);

    // Core glow: bright center that dims with energy
    float core = exp(-dist * (2.5 + (1.0 - vEnergy) * 2.0));
    // Energy drives the core brightness multiplier
    float coreMult = 2.0 + vEnergy * 1.5 + vIsWhale * 3.0;
    vec3 finalColor = vColor * (1.0 + core * coreMult);

    // Subtle outer halo for whale particles
    float halo = exp(-dist * dist * 1.5) * vIsWhale * 0.3;
    alpha = alpha + halo;

    gl_FragColor = vec4(finalColor, alpha * vOpacity);
  }
`;

export const whaleGlowVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const whaleGlowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec2 vUv;

  void main() {
    float dist = length(vUv - 0.5) * 2.0;
    float glow = exp(-dist * dist * 2.5);
    float edge = 1.0 - smoothstep(0.7, 1.0, dist);
    float alpha = glow * edge * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export const ambientVertexShader = /* glsl */ `
  attribute float aSize;

  varying float vAlpha;

  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vec3 pos = position;
    pos.x += sin(uTime * 0.1 + position.y * 0.5) * 0.15;
    pos.y += cos(uTime * 0.08 + position.z * 0.5) * 0.15;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);

    vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 0.5 + position.x * 10.0 + position.y * 7.0));

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ambientFragmentShader = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uColor;
  uniform float uDim;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center) * 2.0;
    if (dist > 1.0) discard;

    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha *= vAlpha * 0.35 * uDim;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
