const wind = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uWindSpeed;
uniform vec2 uWindDir;
uniform float uTreeHeight;

vec3 windOffset(vec3 p) {
  float h = max(p.y - 0.25, 0.0) / max(uTreeHeight, 0.5);
  float bend = h * h * uWind;
  float t = uTime * uWindSpeed;
  float sway = 0.55 + 0.45 * sin(t * 0.9 + p.x * 0.22 + p.z * 0.17);
  float gust = 0.5 + 0.5 * sin(t * 0.31 + 1.7) * sin(t * 0.53 + 0.4);
  vec3 along = vec3(uWindDir.x, 0.0, uWindDir.y);
  vec3 across = vec3(-uWindDir.y, 0.0, uWindDir.x);
  vec3 offset = along * bend * (0.18 + 0.32 * sway * (0.6 + 0.8 * gust));
  offset += across * bend * 0.08 * sin(t * 1.7 + p.y * 0.9 + p.x);
  offset.y -= bend * 0.05 * (0.5 + 0.5 * sin(t * 1.1 + p.z));
  return offset;
}
`;

const shadow = /* glsl */ `
uniform sampler2DShadow uShadowMap;
uniform float uShadowRadius;

const vec2 POISSON[16] = vec2[16](
  vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725),
  vec2(-0.09418410, -0.92938870), vec2(0.34495938, 0.29387760),
  vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464),
  vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.75648379),
  vec2(0.44323325, -0.97511554), vec2(0.53742981, -0.47373420),
  vec2(-0.26496911, -0.41893023), vec2(0.79197514, 0.19090188),
  vec2(-0.24188840, 0.99706507), vec2(-0.81409955, 0.91437590),
  vec2(0.19984126, 0.78641367), vec2(0.14383161, -0.14100790)
);

float sunlight(vec4 coord, float bias) {
  vec3 c = coord.xyz / coord.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float lit = 0.0;
  for (int i = 0; i < 16; i++) {
    lit += texture(uShadowMap, vec3(c.xy + POISSON[i] * uShadowRadius, c.z - bias));
  }
  return lit / 16.0;
}
`;

const ramp = /* glsl */ `
uniform vec3 uRamp[4];

vec3 rampColor(float k) {
  if (k < 0.38) return mix(uRamp[0], uRamp[1], smoothstep(0.0, 0.38, k));
  if (k < 0.74) return mix(uRamp[1], uRamp[2], smoothstep(0.38, 0.74, k));
  return mix(uRamp[2], uRamp[3], smoothstep(0.74, 1.0, k));
}
`;

const atlas = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uAtlasCells;

vec4 atlasTexel(float cell, vec2 uv) {
  return texture(uAtlas, vec2((cell + uv.x) / uAtlasCells, uv.y));
}

float crispAlpha(float a) {
  return clamp((a - 0.5) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0);
}
`;

const billboard = /* glsl */ `
vec3 billboard(vec3 center, vec2 corner, float angle, float size) {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(angle);
  float s = sin(angle);
  vec2 q = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
  return center + right * q.x + up * q.y;
}
`;

const hash = /* glsl */ `
float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
`;

const mound = /* glsl */ `
uniform float uMoundRadius;
uniform float uMoundHeight;

float moundHeight(vec2 xz) {
  float r = length(xz) / uMoundRadius;
  return r < 1.0 ? uMoundHeight * pow(1.0 - r * r, 1.3) : 0.0;
}
`;

export const leafVertex = /* glsl */ `
${wind}
${billboard}
uniform float uGrow;
uniform float uGrowWidth;
uniform float uBlow;
uniform float uLeafScale;
uniform float uRegrow;
uniform float uShape;
uniform float uDabShare;
uniform float uDabCell;
uniform mat4 uShadowMatrix;

in vec3 iPos;
in vec3 iNormal;
in vec4 iData;
in float iExposure;
in float iGone;

out vec2 vUv;
out vec3 vNormal;
out float vRnd;
out float vExposure;
out float vShape;
out vec4 vShadowCoord;

float easeOutBack(float x) {
  float y = x - 1.0;
  return 1.0 + 2.9 * y * y * y + 1.9 * y * y;
}

float hash11(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  float size = iData.x * uLeafScale;
  float angle = iData.y;
  float rnd = iData.z;
  float arrival = iData.w;

  float grown = uBlow > 0.0 ? 1.0 : clamp((uGrow * (1.0 + uGrowWidth) - arrival) / uGrowWidth, 0.0, 1.0);
  size *= grown > 0.0 ? easeOutBack(grown) : 0.0;

  vec3 along = vec3(uWindDir.x, 0.0, uWindDir.y);
  vec3 across = vec3(-uWindDir.y, 0.0, uWindDir.x);
  float t = uTime * uWindSpeed;
  vec3 p = iPos + windOffset(iPos);
  angle += sin(t * (2.6 + rnd * 2.2) + rnd * 40.0) * 0.22 * uWind;
  p += along * sin(t * (3.1 + rnd * 1.7) + rnd * 17.0) * 0.025 * uWind;

  float lead = clamp(0.5 - dot(iPos, along) * 0.12, 0.0, 1.0);
  float blow = clamp((uBlow - rnd * 0.32 - lead * 0.22) / 0.46, 0.0, 1.0);
  vec3 scatter = vec3(hash11(rnd * 91.0) - 0.5, hash11(rnd * 37.0) - 0.35, hash11(rnd * 53.0) - 0.5);
  p += along * (7.0 + rnd * 7.0) * blow * blow + scatter * 5.0 * blow;
  p += (vec3(0.0, sin(blow * 3.0 + rnd * 9.0) * 0.6, 0.0) + across * sin(blow * 5.0 + rnd * 20.0) * 0.8) * blow;
  angle += blow * (5.0 + rnd * 9.0);
  size *= 1.0 - smoothstep(0.6, 1.0, blow);

  float since = uTime - iGone;
  size *= since < 0.0 ? 1.0 : since < uRegrow ? 0.0 : easeOutBack(clamp((since - uRegrow) / 0.5, 0.0, 1.0));

  vec3 world = billboard(p, position.xy, angle, size);
  vUv = uv;
  vShape = fract(rnd * 7.31) < uDabShare ? uDabCell : uShape;
  vNormal = iNormal;
  vRnd = rnd;
  vExposure = iExposure;
  vShadowCoord = uShadowMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const leafFragment = /* glsl */ `
${shadow}
${ramp}
${atlas}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uVary;

in vec2 vUv;
in vec3 vNormal;
in float vRnd;
in float vExposure;
in float vShape;
in vec4 vShadowCoord;

out vec4 fragColor;

void main() {
  vec4 tex = atlasTexel(vShape, vUv);
  float alpha = crispAlpha(tex.a);
  if (alpha < 0.02) discard;
  vec3 n = normalize(vNormal);
  float sun = sunlight(vShadowCoord, 0.0025);
  float light = 0.06 + 0.94 * smoothstep(-0.35, 0.7, dot(n, uSunDir));
  light *= mix(0.5, 1.0, sun);
  light *= mix(0.45, 1.0, smoothstep(0.2, 0.98, vExposure));
  light += max(n.y, 0.0) * 0.12;
  float k = clamp(light + (vRnd - 0.5) * uVary + (tex.r - 0.9) * 0.6, 0.0, 1.0);
  vec3 color = rampColor(k) * mix(vec3(1.0), uSunColor, 0.15 * k);
  fragColor = vec4(color, alpha);
}
`;

export const leafDepthFragment = /* glsl */ `
${atlas}
in vec2 vUv;
in float vShape;
out vec4 fragColor;

void main() {
  if (atlasTexel(vShape, vUv).a < 0.5) discard;
  fragColor = vec4(1.0);
}
`;

export const barkVertex = /* glsl */ `
${wind}
uniform float uGrow;
uniform float uGrowWidth;
uniform mat4 uShadowMatrix;

in vec3 aCenter;
in float aArrival;

out vec3 vNormal;
out vec2 vUv;
out vec4 vShadowCoord;

void main() {
  float grown = clamp((uGrow * (1.0 + uGrowWidth) - aArrival) / uGrowWidth, 0.0, 1.0);
  grown = sqrt(grown) * (0.45 + 0.55 * clamp(uGrow, 0.0, 1.0));
  vec3 p = aCenter + (position - aCenter) * grown + windOffset(aCenter);
  vNormal = normal;
  vUv = uv;
  vShadowCoord = uShadowMatrix * vec4(p + normal * 0.03, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

export const barkFragment = /* glsl */ `
${shadow}
${hash}
uniform vec3 uSunDir;
uniform vec3 uBark;
uniform vec3 uBarkShade;

in vec3 vNormal;
in vec2 vUv;
in vec4 vShadowCoord;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  float sun = sunlight(vShadowCoord, 0.0025);
  float light = smoothstep(-0.5, 0.45, dot(n, uSunDir)) * mix(0.35, 1.0, sun);
  vec3 color = mix(uBarkShade, uBark, smoothstep(0.25, 0.7, light));
  vec2 cell = floor(vUv * 9.0);
  float ring = fract(vUv.y * 9.0 + hash12(cell) * 0.6);
  float lenticel = smoothstep(0.86, 0.9, ring) * (1.0 - smoothstep(0.95, 0.99, ring));
  color *= 1.0 - lenticel * 0.1;
  color *= 0.95 + hash12(vec2(floor(vUv.x * 14.0), floor(vUv.y * 3.0))) * 0.07;
  fragColor = vec4(color, 1.0);
}
`;

export const solidDepthVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const barkDepthVertex = /* glsl */ `
${wind}
uniform float uGrow;
uniform float uGrowWidth;
in vec3 aCenter;
in float aArrival;

void main() {
  float grown = clamp((uGrow * (1.0 + uGrowWidth) - aArrival) / uGrowWidth, 0.0, 1.0);
  grown = sqrt(grown) * (0.45 + 0.55 * clamp(uGrow, 0.0, 1.0));
  vec3 p = aCenter + (position - aCenter) * grown + windOffset(aCenter);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

export const depthFragment = /* glsl */ `
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }
`;

export const groundVertex = /* glsl */ `
uniform mat4 uShadowMatrix;
out vec3 vWorld;
out vec4 vShadowCoord;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vShadowCoord = uShadowMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const groundFragment = /* glsl */ `
${shadow}
${hash}
uniform vec3 uGround;
uniform vec3 uGravel;
uniform vec3 uRake;
uniform vec3 uShadowColor;
uniform float uShadowStrength;
uniform float uRakeStrength;
uniform float uRakeRadius;
uniform vec4 uStones[6];
uniform int uStoneCount;

in vec3 vWorld;
in vec4 vShadowCoord;

out vec4 fragColor;

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  vec2 p = vWorld.xz;
  float r = length(p);
  float d = r - uRakeRadius;
  for (int i = 0; i < 6; i++) {
    if (i >= uStoneCount) break;
    vec4 stone = uStones[i];
    d = smoothMin(d, length((p - stone.xy) / vec2(1.0, stone.w)) - stone.z, 0.6);
  }

  float k = d / 0.2;
  float width = fwidth(k);
  float toLine = abs(fract(k) - 0.5) * 2.0;
  float groove = smoothstep(0.55 - width, 0.95 + width, 1.0 - toLine);
  groove *= 1.0 - smoothstep(0.35, 0.7, width);
  float near = smoothstep(5.5, 2.2, r) * smoothstep(0.0, 0.08, d);
  float gravel = smoothstep(11.5, 6.5, r);

  vec3 color = mix(uGround, uGravel, gravel);
  color = mix(color, uRake, groove * near * uRakeStrength * 0.5);
  color *= 1.0 + (hash12(floor(p * 55.0)) - 0.5) * 0.035 * gravel;

  float lit = sunlight(vShadowCoord, 0.001);
  color = mix(color, uShadowColor, (1.0 - lit) * uShadowStrength * smoothstep(15.0, 9.0, r));
  fragColor = vec4(color, 1.0);
}
`;

export const solidVertex = /* glsl */ `
uniform mat4 uShadowMatrix;
out vec3 vNormal;
out vec3 vWorld;
out vec4 vShadowCoord;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vWorld = world.xyz;
  vShadowCoord = uShadowMatrix * vec4(world.xyz + vNormal * 0.05, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const solidFragment = /* glsl */ `
${shadow}
${hash}
uniform vec3 uSunDir;
uniform vec3 uLit;
uniform vec3 uDark;
uniform float uGrain;

in vec3 vNormal;
in vec3 vWorld;
in vec4 vShadowCoord;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  float sun = sunlight(vShadowCoord, 0.0025);
  float light = smoothstep(-0.2, 0.55, dot(n, uSunDir)) * mix(0.3, 1.0, sun);
  vec3 color = mix(uDark, uLit, smoothstep(0.15, 0.75, light));
  color *= 1.0 + (hash12(floor(vWorld.xz * 30.0 + vWorld.y * 17.0)) - 0.5) * uGrain;
  fragColor = vec4(color, 1.0);
}
`;

export const fallVertex = /* glsl */ `
${mound}
${billboard}
uniform float uTime;
uniform float uFade;
uniform float uLeafScale;
uniform float uShape;
uniform float uDabShare;
uniform float uDabCell;
uniform mat4 uShadowMatrix;

in vec3 aStart;
in vec3 aVelocity;
in vec3 aTerminal;
in vec4 aTiming;
in vec4 aLook;

out vec2 vUv;
out float vRnd;
out float vAlpha;
out float vLanded;
out float vFlip;
out float vShape;
out float vAmbient;
out vec4 vShadowCoord;

const float DRAG = 2.4;

vec3 flight(float t) {
  float e = (1.0 - exp(-DRAG * t)) / DRAG;
  return aStart + aVelocity * e + aTerminal * (t - e);
}

void main() {
  float spawn = aTiming.x;
  float airTime = aTiming.y;
  float restTime = aTiming.z;
  float seed = aTiming.w;
  float size = aLook.x;
  float spin = aLook.y;
  float rnd = aLook.z;
  float ambient = step(0.5, aLook.w);

  float age = uTime - spawn;
  float life = airTime + restTime;
  float tf = clamp(age, 0.0, airTime);
  vec3 p = flight(tf);
  vec3 across = vec3(-aTerminal.z, 0.0, aTerminal.x);
  across = dot(across, across) > 1e-6 ? normalize(across) : vec3(1.0, 0.0, 0.0);
  float flutter = smoothstep(0.0, 0.8, tf) * (1.0 - smoothstep(airTime - 0.6, airTime, tf));
  p += across * sin(tf * (1.8 + fract(seed * 5.1)) + seed * 30.0) * 0.3 * flutter;

  float landed = smoothstep(airTime, airTime + 0.18, age);
  float lift = length(p.xz) < uMoundRadius ? 0.07 : 0.012;
  p.y = max(p.y, moundHeight(p.xz) + mix(0.0, lift + fract(seed * 91.0) * 0.008, landed));

  float alpha = step(0.0, age) * step(age, life);
  float fadeOut = mix(2.5, 1.2, ambient);
  alpha *= smoothstep(0.0, 0.3, age) * (1.0 - smoothstep(life - fadeOut, life, age));
  alpha *= mix(1.0, 0.75, landed * ambient) * uFade;

  float angle = spin * tf + seed * 6.28;
  float flip = cos(tf * (2.0 + spin));
  vec2 corner = position.xy;
  corner.x *= mix(abs(flip) * 0.85 + 0.15, 1.0, landed);
  float sz = size * uLeafScale * step(0.001, alpha);

  vec3 airborne = billboard(p, corner, angle, sz);
  vec3 squashed = billboard(p, corner * vec2(1.0, 0.42), angle, sz);
  vec3 tangentX = vec3(cos(angle), 0.0, sin(angle));
  vec3 tangentZ = normalize(vec3(-sin(angle), 0.0, cos(angle)) + vec3(0.0, 0.5, 0.0));
  vec3 lying = p + (tangentX * corner.x + tangentZ * corner.y) * sz;
  vec3 world = mix(airborne, mix(lying, squashed, ambient), landed);

  vUv = uv;
  vRnd = rnd;
  vAlpha = alpha;
  vLanded = landed;
  vFlip = abs(flip);
  vAmbient = ambient;
  vShape = ambient < 0.5 && fract(rnd * 7.31) < uDabShare ? uDabCell : uShape;
  vShadowCoord = uShadowMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const fallFragment = /* glsl */ `
${shadow}
${ramp}
${atlas}
in vec2 vUv;
in float vRnd;
in float vAlpha;
in float vLanded;
in float vFlip;
in float vShape;
in float vAmbient;
in vec4 vShadowCoord;

out vec4 fragColor;

vec3 knockedColor(vec4 tex) {
  float sun = sunlight(vShadowCoord, 0.0025);
  float k = 0.5 + (vRnd - 0.5) * 0.7 + (tex.r - 0.9) * 0.6 + (vFlip - 0.5) * 0.25 * (1.0 - vLanded);
  k = clamp(k, 0.0, 1.0) * mix(0.55, 1.0, sun * mix(1.0, 0.9, vLanded));
  return rampColor(k);
}

vec3 ambientColor(vec4 tex) {
  float pick = fract(vRnd * 13.7);
  vec3 base = pick < 0.34 ? uRamp[0] : pick < 0.62 ? uRamp[1] : pick < 0.84 ? uRamp[2] : uRamp[3];
  float shade = mix(0.82 + 0.18 * vFlip, 0.9, vLanded);
  return base * shade * mix(0.88, 1.0, tex.r);
}

void main() {
  vec4 tex = atlasTexel(vShape, vUv);
  float alpha = crispAlpha(tex.a) * vAlpha;
  if (alpha < 0.02) discard;
  vec3 color = vAmbient > 0.5 ? ambientColor(tex) : knockedColor(tex);
  fragColor = vec4(color, alpha);
}
`;

export const screenVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const composeFragment = /* glsl */ `
${hash}
uniform sampler2D uFrame;
uniform float uTime;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 color = texture(uFrame, vUv).rgb;
  color += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  fragColor = vec4(color, 1.0);
}
`;
