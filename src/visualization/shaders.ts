export const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vOpacity;

  uniform float uPixelRatio;
  uniform float uTime;

  void main() {
    vColor = color;
    vOpacity = aOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const particleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center) * 2.0;

    if (dist > 1.0) discard;

    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 1.5);

    float core = exp(-dist * 3.0);
    vec3 finalColor = vColor * (1.0 + core * 2.0);

    gl_FragColor = vec4(finalColor, alpha * vOpacity);
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

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center) * 2.0;
    if (dist > 1.0) discard;

    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha *= vAlpha * 0.35;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
