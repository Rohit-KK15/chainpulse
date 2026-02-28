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
    float sharpness = 1.2 + vEnergy * 0.5;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, sharpness);

    // Core glow: bright center that dims with energy
    float core = exp(-dist * (2.5 + (1.0 - vEnergy) * 2.0));
    float coreMult = 2.0 + vEnergy * 1.5;
    vec3 finalColor = vColor * (1.0 + core * coreMult);

    if (vIsWhale > 0.5) {
      // ── Whale-specific rendering ──

      // Intense bright core with wider hot center
      float whaleCore = exp(-dist * dist * 8.0);
      finalColor += vColor * whaleCore * 4.0;

      // Mid-range aura layer
      float midGlow = exp(-dist * dist * 2.5);
      finalColor += vColor * midGlow * 1.2;

      // Wide soft atmospheric halo — fades to zero before edge
      float halo = exp(-dist * dist * 1.8) * (1.0 - smoothstep(0.5, 0.95, dist));
      alpha += halo * 0.25;

      // Chromatic fringe
      float edgeMask = 1.0 - smoothstep(0.4, 0.9, dist);
      finalColor.r += exp(-dist * dist * 2.0) * vColor.r * 0.3 * edgeMask;
      finalColor.b += exp(-dist * dist * 4.5) * vColor.b * 0.2 * edgeMask;
    }

    // Smooth fade to zero at the boundary — no hard cutoff
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, dist);
    gl_FragColor = vec4(finalColor, alpha * vOpacity * edgeFade);
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
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv) * 2.0;

    if (dist > 1.0) discard;

    // Slow breathing distortion on the radius
    float breath = 0.97 + 0.03 * sin(uTime * 1.1);
    float d = dist / breath;

    // ── Smooth edge fade — everything feathers to zero before boundary ──
    float edgeFade = 1.0 - smoothstep(0.5, 1.0, dist);

    // ── Multi-layer glow ──
    float innerCore = exp(-d * d * 14.0);
    float midAura   = exp(-d * d * 4.5);
    float outerHaze = exp(-d * d * 2.2);

    float glow = innerCore * 0.55 + midAura * 0.28 + outerHaze * 0.12;

    // ── Chromatic shift ──
    float chR = exp(-d * d * 3.5) * 0.28 + innerCore * 0.55;
    float chG = glow;
    float chB = exp(-d * d * 5.5) * 0.28 + innerCore * 0.55;

    // ── Slow rotating caustic highlights ──
    float angle = atan(uv.y, uv.x);
    float caustic = 0.5 + 0.5 * sin(angle * 3.0 + uTime * 0.6);
    caustic *= 0.5 + 0.5 * sin(angle * 5.0 - uTime * 0.35);
    caustic *= exp(-d * d * 5.0) * 0.08;

    vec3 col = vec3(
      uColor.r * chR + caustic,
      uColor.g * chG + caustic * 0.6,
      uColor.b * chB + caustic * 0.4
    );

    float alpha = (glow + caustic) * uIntensity * edgeFade;
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

export const blockPulseVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const blockPulseFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uOpacity;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv) * 2.0;

    // ── Soft radial fade — content vanishes before geometry edge ──
    float edgeFade = 1.0 - smoothstep(0.75, 0.97, dist);
    if (edgeFade < 0.001) discard;

    // ── Ring sharpness loosens as the wave spreads (sharp → diffuse) ──
    float spread = 1.0 + uProgress * 2.0;
    float sharpness = 22.0 / spread;

    // ── Primary ring: gaussian that softens as it expands ──
    float ringDelta = dist - uProgress;
    float primaryRing = exp(-ringDelta * ringDelta * sharpness);

    // ── Secondary trailing ring: delayed, also softens ──
    float trailPos = max(uProgress - 0.15, 0.0);
    float trailDelta = dist - trailPos;
    float trailRing = exp(-trailDelta * trailDelta * sharpness * 1.4) * 0.3;

    // ── Inner glow: diffuse fill that dissipates as wave expands ──
    float innerFill = exp(-dist * dist * 3.0) * (1.0 - uProgress) * (1.0 - uProgress);

    // ── Angular variation — subtle organic break of perfect symmetry ──
    float angle = atan(uv.y, uv.x);
    float wobble = 1.0 + 0.04 * sin(angle * 6.0 + uTime * 2.0)
                       + 0.025 * sin(angle * 10.0 - uTime * 1.4);

    // ── Combine layers ──
    float ring = primaryRing * wobble * 0.4
               + trailRing * 0.3
               + innerFill * 0.06;

    // ── Chromatic depth ──
    float chromaShift = primaryRing * 0.08;
    vec3 col = vec3(
      uColor.r + chromaShift * 0.5,
      uColor.g + chromaShift * 0.3,
      uColor.b + chromaShift
    );

    float alpha = ring * uOpacity * edgeFade;
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

export const ambientVertexShader = /* glsl */ `
  attribute float aSize;

  varying float vAlpha;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAmplitude;

  void main() {
    vec3 pos = position;
    pos.x += sin(uTime * 0.1 + position.y * 0.5) * 0.15 * uAmplitude;
    pos.y += cos(uTime * 0.08 + position.z * 0.5) * 0.15 * uAmplitude;

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
