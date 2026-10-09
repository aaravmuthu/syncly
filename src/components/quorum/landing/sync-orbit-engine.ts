/**
 * The landing hero's WebGL scene: eight glossy spheres (the friends in a
 * squad) pulled into one orbiting cluster, the tagline wrapped around them on
 * the inside of a slowly turning cylinder, and water ripples that follow the
 * cursor. Pointer-down scatters the cluster; it pulls itself back together.
 *
 * Everything is raw WebGL2 with three programs:
 *   scene  – analytic ray-sphere tracing over the text cylinder, with soft
 *            shadows on an implicit floor and one reflection bounce
 *   wave   – a ping-pong height field (the ripples)
 *   output – refracts the scene through the height field
 *
 * Colours come from the page's own theme tokens, so it follows light/dark.
 */

export type OrbitTheme = {
  background: [number, number, number];
  foreground: [number, number, number];
  primary: [number, number, number];
  accent: [number, number, number];
  dark: boolean;
};

export type OrbitOptions = {
  /** The two lines wrapped around the cylinder. */
  lines: [string, string];
  /** Font for the wrapped lines: CSS weight and family, e.g. `600` and `"Bricolage Grotesque"`. */
  fontWeight: string;
  fontFamily: string;
  /** Render a single settled frame and never animate. */
  still: boolean;
};

const COUNT = 8;
// The last sphere is the one warm "spark"; the rest are evergreen.
const RADII = [0.36, 0.34, 0.31, 0.33, 0.29, 0.35, 0.3, 0.25];
const SPARK = COUNT - 1;
const CAMERA_Z = -3.1;
const TILES = 4;
const TILE_W = 2560;
const TILE_H = 640;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const SCENE_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uHalfW;
uniform float uSpin;
uniform float uTiles;
uniform float uBandH;
uniform float uBandY;
uniform sampler2D uText;
uniform vec4 uSph[${COUNT}];
uniform vec3 uBg, uInk, uBody, uSpark, uShadow, uGlowA, uGlowB;
uniform float uDark;
uniform float uCamZ;
uniform float uFloorY;
out vec4 outColor;

const vec3 L = normalize(vec3(-0.45, 0.95, -0.35));

// The tagline on the inside of a unit cylinder around the camera; it lives
// at infinity, so reflections read it with the same function. No early
// returns: the screen pass samples with derivatives, and those are garbage
// in divergent control flow (it drew dashed lines along the band's edges).
vec2 bandUV(vec3 d, out float inside) {
  float h = max(length(d.xz), 1e-4);
  float v = (d.y / h - uBandY) / (2.0 * uBandH) + 0.5;
  inside = step(0.0, v) * step(v, 1.0);
  float u = (atan(d.x, d.z) + uSpin) / 6.2831853 * uTiles;
  return vec2(u, 1.0 - v);
}

// Screen rays: explicit gradients, with the atan seam unwrapped.
float textScreen(vec3 d) {
  float inside;
  vec2 uv = bandUV(d, inside);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  dx.x -= uTiles * round(dx.x / uTiles);
  dy.x -= uTiles * round(dy.x / uTiles);
  return textureGrad(uText, uv, dx, dy).a * inside;
}

// Reflections are minified hard by the curvature; a fixed blur level reads right.
float textReflected(vec3 d) {
  float inside;
  vec2 uv = bandUV(d, inside);
  return textureLod(uText, uv, 2.5).a * inside;
}

float inkAlpha() { return uDark > 0.5 ? 0.92 : 0.9; }

vec3 envReflected(vec3 d) {
  vec3 c = mix(uBg, uInk, textReflected(d) * inkAlpha());
  // the floor seen in a reflection: a soft darkening below the horizon
  return mix(c, uShadow, smoothstep(-0.05, -0.6, d.y) * 0.4);
}

bool hitSphere(vec3 ro, vec3 rd, vec4 s, out float t) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - s.w * s.w;
  float h = b * b - c;
  if (h < 0.0) return false;
  t = -b - sqrt(h);
  return t > 1e-3;
}

// Penumbra-style soft shadow towards the light from every sphere.
float softShadow(vec3 p, vec3 dir, float k, int skip) {
  float s = 1.0;
  for (int i = 0; i < ${COUNT}; i++) {
    if (i == skip) continue;
    vec3 oc = p - uSph[i].xyz;
    float b = dot(oc, dir);
    if (b >= 0.0) continue;
    float t = -b;
    float dist = sqrt(max(dot(oc, oc) - b * b, 0.0));
    s = min(s, clamp(0.5 + 0.5 * (dist - uSph[i].w) / (t * k), 0.0, 1.0));
  }
  return s * s * (3.0 - 2.0 * s);
}

// How much of the sky the cluster blocks at p (contact darkening).
float occlusion(vec3 p, vec3 n, int skip) {
  float ao = 1.0;
  for (int i = 0; i < ${COUNT}; i++) {
    if (i == skip) continue;
    vec3 d = uSph[i].xyz - p;
    float l2 = dot(d, d);
    float r = uSph[i].w;
    float facing = max(dot(n, d * inversesqrt(l2)), 0.0);
    ao *= 1.0 - clamp(r * r / l2, 0.0, 1.0) * facing;
  }
  return ao;
}

vec3 sphereColor(int i) { return i == ${SPARK} ? uSpark : uBody; }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 q = (frag - 0.5 * uRes) / (0.5 * uRes.x) * uHalfW;
  vec3 ro = vec3(0.0, 0.0, uCamZ);
  vec3 rd = normalize(vec3(q, 1.0));
  float pix = 2.0 * uHalfW / uRes.x;

  // Background: text cylinder, theme glows, and the floor's shadows.
  vec3 col = mix(uBg, uInk, textScreen(rd) * inkAlpha());
  vec2 uv = frag / uRes;
  col = mix(col, uGlowA, (1.0 - smoothstep(0.0, 0.62, length((uv - vec2(0.08, 1.0)) * vec2(1.0, 1.25)))) * 0.1);
  col = mix(col, uGlowB, (1.0 - smoothstep(0.0, 0.55, length((uv - vec2(1.0, 0.0)) * vec2(1.0, 1.3)))) * 0.12);
  if (rd.y < 0.0) {
    float tf = (uFloorY - ro.y) / rd.y;
    vec3 fp = ro + rd * tf;
    float sh = softShadow(fp, L, 0.75, -1);
    float ao = occlusion(fp, vec3(0.0, 1.0, 0.0), -1);
    float fade = 1.0 - smoothstep(4.0, 12.0, tf);
    float dark = (1.0 - sh * 0.55 - 0.45 * ao) * fade;
    col = mix(col, uShadow, clamp(dark, 0.0, 1.0) * 0.42);
  }

  // Nearest sphere along the ray.
  float tMin = 1e9;
  int hit = -1;
  for (int i = 0; i < ${COUNT}; i++) {
    float t;
    if (hitSphere(ro, rd, uSph[i], t) && t < tMin) { tMin = t; hit = i; }
  }
  // Coverage for an anti-aliased silhouette: the ray's miss distance from
  // the nearest sphere, in pixels at that depth.
  float cover = 0.0;
  int edge = -1;
  float edgeT = 0.0;
  for (int i = 0; i < ${COUNT}; i++) {
    vec3 oc = uSph[i].xyz - ro;
    float t = dot(oc, rd);
    if (t <= 0.0) continue;
    float miss = sqrt(max(dot(oc, oc) - t * t, 0.0)) - uSph[i].w;
    float c = clamp(0.5 - miss / (pix * t), 0.0, 1.0);
    if (c > 0.0 && (hit < 0 || i == hit) && c > cover) { cover = c; edge = i; edgeT = t; }
  }
  if (hit >= 0) cover = 1.0;
  int idx = hit >= 0 ? hit : edge;

  if (idx >= 0) {
    vec4 s = uSph[idx];
    // On an edge pixel the ray misses; shade the closest point on the rim.
    vec3 p = hit >= 0 ? ro + rd * tMin : ro + rd * edgeT;
    vec3 n = normalize(p - s.xyz);
    p = s.xyz + n * s.w;
    vec3 v = -rd;
    vec3 base = sphereColor(idx);

    float diff = max(dot(n, L), 0.0) * softShadow(p + n * 1e-3, L, 0.12, idx);
    float ao = occlusion(p, n, idx);
    vec3 r = reflect(rd, n);

    // One reflection bounce: another sphere, or the environment.
    vec3 refl = envReflected(r);
    float tr = 1e9;
    for (int i = 0; i < ${COUNT}; i++) {
      if (i == idx) continue;
      float t;
      if (hitSphere(p, r, uSph[i], t) && t < tr) {
        tr = t;
        vec3 n2 = normalize(p + r * t - uSph[i].xyz);
        refl = sphereColor(i) * (0.35 + 0.65 * max(dot(n2, L), 0.0));
      }
    }

    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
    vec3 lit = base * (0.32 + 0.68 * diff) * mix(0.55, 1.0, ao);
    vec3 c = mix(lit, refl, mix(0.06, 0.95, fres));
    float spec = pow(max(dot(r, L), 0.0), 90.0) * (0.35 + 0.65 * diff);
    c += vec3(1.0, 0.98, 0.94) * spec * 1.3;
    // a broad second highlight from the floor bounce, tinted by the body
    c += base * pow(max(dot(n, vec3(0.3, -0.7, -0.4)), 0.0), 2.0) * 0.18;
    // rim catching the page colour, so spheres sit in the paper rather than on it
    c = mix(c, uBg, pow(1.0 - ndv, 3.0) * 0.18);
    // after dark the spheres would sink into the page; an evergreen rim keeps their edge
    c += uGlowA * pow(1.0 - ndv, 2.5) * 0.4 * uDark;
    col = mix(col, c, cover);
  }

  // Tiny dither against banding in the soft shadows.
  float n = fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

const WAVE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uA;
uniform vec2 uB;
uniform float uDrop;
uniform float uRadius;
uniform float uDamp;
uniform float uAspect;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 s = texture(uState, uv);
  float sum = texture(uState, uv + vec2(uTexel.x, 0.0)).r
            + texture(uState, uv - vec2(uTexel.x, 0.0)).r
            + texture(uState, uv + vec2(0.0, uTexel.y)).r
            + texture(uState, uv - vec2(0.0, uTexel.y)).r;
  float h = (sum * 0.5 - s.g) * uDamp;
  // Pointer stroke from uA to uB pushes the surface down.
  vec2 k = vec2(uAspect, 1.0);
  vec2 pa = (uv - uA) * k;
  vec2 ba = (uB - uA) * k;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  float d = length(pa - ba * t);
  h -= uDrop * (1.0 - smoothstep(0.0, uRadius, d));
  outColor = vec4(h, s.r, 0.0, 1.0);
}`;

const OUT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uWave;
uniform vec2 uRes;
uniform vec2 uWaveTexel;
uniform float uRefract;
uniform float uDisp;
uniform float uShine;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float hl = texture(uWave, uv - vec2(uWaveTexel.x, 0.0)).r;
  float hr = texture(uWave, uv + vec2(uWaveTexel.x, 0.0)).r;
  float hd = texture(uWave, uv - vec2(0.0, uWaveTexel.y)).r;
  float hu = texture(uWave, uv + vec2(0.0, uWaveTexel.y)).r;
  vec2 g = vec2(hr - hl, hu - hd);
  vec2 off = g * uRefract;
  vec3 c;
  c.r = texture(uScene, uv + off * (1.0 + uDisp)).r;
  c.g = texture(uScene, uv + off).g;
  c.b = texture(uScene, uv + off * (1.0 - uDisp)).b;
  float crest = dot(g, normalize(vec2(-0.5, 0.8)));
  c += vec3(1.0) * clamp(crest, 0.0, 1.0) * uShine;
  c -= vec3(1.0) * clamp(-crest, 0.0, 1.0) * uShine * 0.6;
  outColor = vec4(c, 1.0);
}`;

type Program = { prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };

function compile(gl: WebGL2RenderingContext, frag: string, uniforms: string[]): Program {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
    }
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
  }
  const u: Program["u"] = {};
  for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
  return { prog, u };
}

// Deterministic so every load opens on the same composition.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export class SyncOrbit {
  private gl: WebGL2RenderingContext;
  private scene: Program;
  private wave: Program | null = null;
  private out: Program;
  private textTex: WebGLTexture;
  private sceneRT: Target | null = null;
  private waves: [Target, Target] | null = null;
  private pos = new Float32Array(COUNT * 3);
  private vel = new Float32Array(COUNT * 3);
  private sph = new Float32Array(COUNT * 4);
  private center = [0, 0.04, 0];
  private pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, active: false, moved: false };
  // Pointer velocity on the cluster's plane (world units/s), for flicking spheres.
  private swipe = { vx: 0, vy: 0, wx: 0, wy: 0, at: 0 };
  private time = 0;
  /** Until this scene time, the cluster collapses into a tight spinning knot. */
  private implodeUntil = -1;
  private acc = 0;
  private halfW = 1.19;
  private theme!: OrbitTheme;
  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: OrbitOptions,
  ) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.scene = compile(gl, SCENE_FRAG, [
      "uRes",
      "uHalfW",
      "uSpin",
      "uTiles",
      "uBandH",
      "uBandY",
      "uText",
      "uSph",
      "uBg",
      "uInk",
      "uBody",
      "uSpark",
      "uShadow",
      "uGlowA",
      "uGlowB",
      "uDark",
      "uCamZ",
      "uFloorY",
    ]);
    this.out = compile(gl, OUT_FRAG, [
      "uScene",
      "uWave",
      "uRes",
      "uWaveTexel",
      "uRefract",
      "uDisp",
      "uShine",
    ]);
    // Ripples need a float render target; without one the scene runs without them.
    if (!opts.still && gl.getExtension("EXT_color_buffer_float")) {
      this.wave = compile(gl, WAVE_FRAG, [
        "uState",
        "uTexel",
        "uA",
        "uB",
        "uDrop",
        "uRadius",
        "uDamp",
        "uAspect",
      ]);
    }

    this.textTex = gl.createTexture()!;
    this.drawText();

    const rand = seeded(7);
    for (let i = 0; i < COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const z = rand() * 2 - 1;
      const rr = Math.sqrt(1 - z * z) * 1.3;
      this.pos.set([Math.cos(a) * rr, z * 0.9, Math.sin(a) * rr], i * 3);
    }
    // Settle the cluster before the first frame so it never opens exploded.
    for (let i = 0; i < 240; i++) this.step(1 / 120);
  }

  setTheme(theme: OrbitTheme) {
    this.theme = theme;
    if (!this.running) this.render();
  }

  /** Redraw the wrapped text, e.g. once the web font has loaded. */
  drawText() {
    const gl = this.gl;
    const c = document.createElement("canvas");
    c.width = TILE_W;
    c.height = TILE_H;
    const ctx = c.getContext("2d")!;
    const size = 200;
    ctx.font = `${this.opts.fontWeight} ${size}px ${this.opts.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    if ("letterSpacing" in ctx) (ctx as { letterSpacing: string }).letterSpacing = "-6px";
    const [a, b] = this.opts.lines;
    const lead = size * 0.98;
    const top = TILE_H / 2 - lead + size * 0.74;
    ctx.fillText(a, TILE_W / 2, top);
    ctx.fillText(b, TILE_W / 2, top + lead);

    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    if (!this.running && this.theme) this.render();
  }

  resize(width: number, height: number, dpr: number) {
    const gl = this.gl;
    this.dpr = dpr;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.sceneRT) return;
    this.canvas.width = w;
    this.canvas.height = h;
    // Portrait screens get a narrower field of view so the cluster and the
    // text keep their presence instead of shrinking to the width.
    const aspect = width / height;
    this.halfW = 1.19 * Math.pow(Math.min(1, aspect), 0.95);

    if (this.sceneRT) this.freeTarget(this.sceneRT);
    this.sceneRT = this.makeTarget(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    if (this.wave) {
      this.waves?.forEach((t) => this.freeTarget(t));
      const ww = Math.max(2, Math.round(width / 3));
      const wh = Math.max(2, Math.round(height / 3));
      this.waves = [
        this.makeTarget(ww, wh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR),
        this.makeTarget(ww, wh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR),
      ];
    }
    if (!this.running && this.theme) this.render();
  }

  /** Pointer position as 0–1 from the canvas's top-left. */
  pointerMove(x: number, y: number) {
    const p = this.pointer;
    const [wx, wy] = this.toWorld(x, y);
    const now = performance.now();
    const sw = this.swipe;
    if (!p.active) {
      p.px = x;
      p.py = y;
    } else {
      const dt = Math.max((now - sw.at) / 1000, 1 / 240);
      // Smoothed, so one jittery event can't fling the cluster off screen.
      const k = Math.min(1, dt * 18);
      sw.vx += ((wx - sw.wx) / dt - sw.vx) * k;
      sw.vy += ((wy - sw.wy) / dt - sw.vy) * k;
    }
    sw.wx = wx;
    sw.wy = wy;
    sw.at = now;
    p.x = x;
    p.y = y;
    p.active = true;
    p.moved = true;
  }

  pointerLeave() {
    this.pointer.active = false;
    this.swipe.vx = 0;
    this.swipe.vy = 0;
  }

  /** Scatter the cluster away from the pointer; gravity pulls it back. */
  burst(x: number, y: number) {
    const [wx, wy] = this.toWorld(x, y);
    for (let i = 0; i < COUNT; i++) {
      const dx = this.pos[i * 3] - wx;
      const dy = this.pos[i * 3 + 1] - wy;
      const dz = this.pos[i * 3 + 2] + 0.4;
      const d = Math.hypot(dx, dy, dz) + 0.2;
      const f = 7 / d;
      this.vel[i * 3] += (dx / d) * f;
      this.vel[i * 3 + 1] += (dy / d) * f;
      this.vel[i * 3 + 2] += (dz / d) * f;
    }
    this.pointer.moved = true;
  }

  /**
   * Collapse the cluster into a tight, fast-spinning knot (the lead-in to
   * the demo warp). Returns where it sits on the canvas, 0–1 from top-left,
   * and its radius as a fraction of the canvas width.
   */
  implode(seconds = 1.2) {
    this.implodeUntil = this.time + seconds;
    let cx = 0,
      cy = 0,
      cz = 0;
    for (let i = 0; i < COUNT; i++) {
      cx += this.pos[i * 3] / COUNT;
      cy += this.pos[i * 3 + 1] / COUNT;
      cz += this.pos[i * 3 + 2] / COUNT;
    }
    this.center[0] = cx;
    this.center[1] = cy;
    const depth = cz - CAMERA_Z;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return {
      x: 0.5 + cx / depth / (2 * this.halfW),
      y: 0.5 - (cy / depth / (2 * this.halfW)) * (w / h),
      r: 0.55 / depth / (2 * this.halfW),
    };
  }

  start() {
    if (this.running || this.opts.still || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.time += dt;
      this.acc += dt;
      while (this.acc >= 1 / 120) {
        this.step(1 / 120);
        this.acc -= 1 / 120;
      }
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private toWorld(x: number, y: number) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const px = (x - 0.5) * 2 * this.halfW;
    const py = (0.5 - y) * 2 * this.halfW * (h / w);
    return [px * -CAMERA_Z, py * -CAMERA_Z];
  }

  /**
   * The cursor as a small invisible finger: spheres it reaches are pushed
   * out of its way, and a moving cursor drags them along with it.
   */
  private touch(dt: number) {
    const { pos, vel, swipe } = this;
    const [wx, wy] = this.toWorld(this.pointer.x, this.pointer.y);
    // Ray from the camera through the pointer.
    let dx = wx / -CAMERA_Z,
      dy = wy / -CAMERA_Z,
      dz = 1;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    const carry = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < COUNT; i++) {
      const o = i * 3;
      const cx = pos[o],
        cy = pos[o + 1],
        cz = pos[o + 2] - CAMERA_Z;
      const t = cx * dx + cy * dy + cz * dz;
      if (t <= 0) continue;
      let nx = cx - dx * t,
        ny = cy - dy * t,
        nz = cz - dz * t;
      const dist = Math.hypot(nx, ny, nz);
      const reach = RADII[i] + 0.16;
      if (dist >= reach) continue;
      if (dist < 1e-4) {
        nx = 0;
        ny = 1;
        nz = 0;
      } else {
        nx /= dist;
        ny /= dist;
        nz /= dist;
      }
      const s = 1 - dist / reach;
      // push out of the finger, firmly but not instantly
      const push = (reach - dist) * 0.35;
      pos[o] += nx * push;
      pos[o + 1] += ny * push;
      pos[o + 2] += nz * push;
      vel[o] += nx * 40 * s * dt;
      vel[o + 1] += ny * 40 * s * dt;
      vel[o + 2] += nz * 40 * s * dt;
      // and take on the cursor's motion, so a swipe flicks it
      vel[o] += (swipe.vx * 1.15 - vel[o]) * s * carry;
      vel[o + 1] += (swipe.vy * 1.15 - vel[o + 1]) * s * carry;
    }
    // A resting cursor stops flicking.
    const settle = Math.exp(-dt * 6);
    swipe.vx *= settle;
    swipe.vy *= settle;
  }

  private step(dt: number) {
    const { pos, vel } = this;
    // The cluster's centre leans a little towards the pointer and drifts.
    const t = this.time;
    let tx = Math.sin(t * 0.31) * 0.12;
    let ty = 0.04 + Math.sin(t * 0.47) * 0.06;
    if (this.pointer.active) {
      const [wx, wy] = this.toWorld(this.pointer.x, this.pointer.y);
      tx += wx * 0.28;
      ty += wy * 0.28;
    }
    // While imploding the centre holds still, so the warp grows from where the knot is.
    const imploding = t < this.implodeUntil;
    const k = imploding ? 0 : 1 - Math.exp(-dt * 2.5);
    this.center[0] += (tx - this.center[0]) * k;
    this.center[1] += (ty - this.center[1]) * k;

    if (this.pointer.active && !imploding) this.touch(dt);
    const pull = imploding ? 48 : 6;
    const swirl = imploding ? 9 : 1.7;

    // Orbit axis tilted off vertical, so the cluster tumbles rather than spins flat.
    const ax = 0.28,
      ay = 0.94,
      az = 0.18;
    const damp = Math.exp(-dt * 1.1);
    for (let i = 0; i < COUNT; i++) {
      const o = i * 3;
      const dx = pos[o] - this.center[0];
      const dy = pos[o + 1] - this.center[1];
      const dz = pos[o + 2] - this.center[2];
      // pull to the centre, plus a swirl around the axis
      vel[o] += (-pull * dx + (ay * dz - az * dy) * swirl) * dt;
      vel[o + 1] += (-pull * dy + (az * dx - ax * dz) * swirl) * dt;
      vel[o + 2] += (-pull * dz + (ax * dy - ay * dx) * swirl) * dt;
      vel[o] *= damp;
      vel[o + 1] *= damp;
      vel[o + 2] *= damp;
      pos[o] += vel[o] * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += vel[o + 2] * dt;
    }
    // Collisions: separate overlapping spheres and bounce them softly.
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const a = i * 3,
          b = j * 3;
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-4;
        const overlap = RADII[i] + RADII[j] - d;
        if (overlap <= 0) continue;
        const nx = dx / d,
          ny = dy / d,
          nz = dz / d;
        pos[a] -= nx * overlap * 0.5;
        pos[a + 1] -= ny * overlap * 0.5;
        pos[a + 2] -= nz * overlap * 0.5;
        pos[b] += nx * overlap * 0.5;
        pos[b + 1] += ny * overlap * 0.5;
        pos[b + 2] += nz * overlap * 0.5;
        const vn =
          (vel[b] - vel[a]) * nx + (vel[b + 1] - vel[a + 1]) * ny + (vel[b + 2] - vel[a + 2]) * nz;
        if (vn < 0) {
          const jn = (-(1 + 0.25) * vn) / 2;
          vel[a] -= jn * nx;
          vel[a + 1] -= jn * ny;
          vel[a + 2] -= jn * nz;
          vel[b] += jn * nx;
          vel[b + 1] += jn * ny;
          vel[b + 2] += jn * nz;
        }
      }
    }
  }

  private render() {
    const gl = this.gl;
    const rt = this.sceneRT;
    if (!rt || !this.theme || this.disposed) return;
    const th = this.theme;
    const W = this.canvas.width,
      H = this.canvas.height;

    for (let i = 0; i < COUNT; i++) {
      this.sph.set([this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], RADII[i]], i * 4);
    }

    // 1. scene
    const s = this.scene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(s.prog);
    gl.uniform2f(s.u.uRes, W, H);
    gl.uniform1f(s.u.uHalfW, this.halfW);
    gl.uniform1f(s.u.uSpin, this.opts.still ? 0.35 : 0.35 + this.time * 0.09);
    gl.uniform1f(s.u.uTiles, TILES);
    // Tile aspect on the cylinder: arc length 2π/TILES over TILE_W/TILE_H.
    gl.uniform1f(s.u.uBandH, ((2 * Math.PI) / TILES / (TILE_W / TILE_H)) * 0.5);
    gl.uniform1f(s.u.uBandY, 0.02);
    gl.uniform4fv(s.u.uSph, this.sph);
    gl.uniform1f(s.u.uCamZ, CAMERA_Z);
    gl.uniform1f(s.u.uFloorY, -1.3);
    gl.uniform1f(s.u.uDark, th.dark ? 1 : 0);
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
    gl.uniform3fv(s.u.uBg, th.background);
    gl.uniform3fv(s.u.uInk, th.foreground);
    // Lacquered evergreen: deeper than the UI token so highlights have room.
    gl.uniform3fv(s.u.uBody, mix(th.primary, [0, 0.02, 0.015], th.dark ? 0.38 : 0.3));
    gl.uniform3fv(s.u.uSpark, mix(th.accent, [0.1, 0.04, 0], th.dark ? 0.25 : 0.12));
    gl.uniform3fv(
      s.u.uShadow,
      th.dark ? mix(th.background, [0, 0, 0], 0.8) : mix(th.foreground, th.primary, 0.3),
    );
    gl.uniform3fv(s.u.uGlowA, th.primary);
    gl.uniform3fv(s.u.uGlowB, th.accent);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.uniform1i(s.u.uText, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. ripples
    let waveTex: WebGLTexture | null = null;
    let waveW = 1,
      waveH = 1;
    if (this.wave && this.waves) {
      const [a, b] = this.waves;
      const p = this.pointer;
      const w = this.wave;
      gl.useProgram(w.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
      gl.viewport(0, 0, b.w, b.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform1i(w.u.uState, 0);
      gl.uniform2f(w.u.uTexel, 1 / b.w, 1 / b.h);
      gl.uniform2f(w.u.uA, p.px, 1 - p.py);
      gl.uniform2f(w.u.uB, p.x, 1 - p.y);
      const speed = Math.hypot(p.x - p.px, p.y - p.py);
      gl.uniform1f(w.u.uDrop, p.moved ? Math.min(0.02 + speed * 1.4, 0.16) : 0);
      gl.uniform1f(w.u.uRadius, 0.035);
      gl.uniform1f(w.u.uDamp, 0.975);
      gl.uniform1f(w.u.uAspect, b.w / b.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      p.px = p.x;
      p.py = p.y;
      p.moved = false;
      this.waves = [b, a];
      waveTex = b.tex;
      waveW = b.w;
      waveH = b.h;
    }

    // 3. output
    const o = this.out;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(o.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rt.tex);
    gl.uniform1i(o.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, waveTex ?? rt.tex);
    gl.uniform1i(o.u.uWave, 1);
    gl.uniform2f(o.u.uRes, W, H);
    gl.uniform2f(o.u.uWaveTexel, 1 / waveW, 1 / waveH);
    gl.uniform1f(o.u.uRefract, waveTex ? 0.35 : 0);
    gl.uniform1f(o.u.uDisp, 0.12);
    gl.uniform1f(o.u.uShine, waveTex ? (th.dark ? 0.45 : 0.25) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private makeTarget(
    w: number,
    h: number,
    internal: number,
    format: number,
    type: number,
    filter: number,
  ): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  }

  private freeTarget(t: Target) {
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fb);
  }
}
