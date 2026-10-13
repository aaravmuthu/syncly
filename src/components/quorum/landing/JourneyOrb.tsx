import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";

const VERTEX = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0., 1.); }`;

// Analytic spheres, not ray marching. One small canvas carries the material
// through every chapter, taking over the hero sphere at the scroll handoff.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 resolution, pointer;
uniform float progress, time, burst, dark, compact, arrival;
uniform vec3 tint;
out vec4 color;
const float PI = 3.14159265;
vec3 pose(float i) {
  if(i < .5) return vec3(-.18, .12, .72);
  if(i < 1.5) return vec3(.38, .48, .48);
  if(i < 2.5) return vec3(-.58, .50, .40);
  if(i < 3.5) return vec3(.58, .48, .48);
  if(i < 4.5) return vec3(-.48, .48, .46);
  if(i < 5.5) return vec3(0., .48, .42);
  return vec3(0., .38, .60);
}
float hit(vec3 ro, vec3 rd, vec3 center, float radius) {
  vec3 oc = ro-center;
  float b = dot(oc,rd), c = dot(oc,oc)-radius*radius;
  float h = b*b-c;
  return h < 0. ? 999. : -b-sqrt(h);
}
vec3 environment(vec3 r) {
  float soft = pow(max(dot(r,normalize(vec3(-.8,1.2,1.))),0.),5.);
  float window = pow(max(dot(r,normalize(vec3(-.5,.85,1.))),0.),80.);
  float edge = pow(max(dot(r,normalize(vec3(1.,.15,.5))),0.),20.);
  float stripe = (1.-smoothstep(.005,.035,abs(r.y-.42)))*smoothstep(-.5,-.15,r.x)*(1.-smoothstep(.1,.7,r.x));
  return vec3(.035) + tint * soft*.22 + vec3(.9,1.,.96)*(window*.75+stripe*.13) + tint*edge*.32;
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-resolution)/resolution.y;
  float camera=max(mix(4.2,6.,compact),resolution.y/resolution.x*4.6);
  vec3 ro=vec3(0.,0.,camera), rd=normalize(vec3(uv,-3.1));
  float stage=clamp(progress*7.,0.,6.);
  float index=floor(stage), blend=smoothstep(0.,1.,fract(stage));
  vec3 body=mix(pose(index),pose(min(6.,index+1.)),blend);
  body.y += compact*.65*smoothstep(.45,1.,stage);
  body.xy += pointer*.09;
  body.z *= 1.+burst*.045;
  float closest=999.;
  vec3 center=vec3(body.xy,0.);
  float sphereRadius=body.z;
  float d=hit(ro,rd,center,sphereRadius);
  if(d < closest) closest=d;
  vec3 chosen=center;
  float chosenRadius=sphereRadius;
  float member=0.;
  float gathering=smoothstep(5.2,6.,stage);
  float privateMode=smoothstep(.7,1.2,stage)*(1.-smoothstep(1.8,2.3,stage));
  for(int j=0;j<7;j++){
    float k=float(j);
    float angle=k*PI*2./7.+time*.10+stage*.28;
    float radius=mix(1.03,.57,gathering)+burst*.60;
    float satelliteSize=mix(mix(.21,.025,smoothstep(.4,1.,stage)),.16,gathering)*(1.-privateMode*.5);
    satelliteSize *= smoothstep(.72,1.,arrival);
    if(satelliteSize<.04) continue;
    vec3 satellite=vec3(body.xy+vec2(cos(angle),sin(angle))*
      vec2(radius,radius*.65),sin(angle)*.22-.28);
    float candidate=hit(ro,rd,satellite,satelliteSize);
    if(candidate<closest){closest=candidate;chosen=satellite;chosenRadius=satelliteSize;member=k+1.;}
  }
  if(closest>100.){color=vec4(0.);return;}
  vec3 surface=ro+rd*closest;
  vec3 normal=normalize(surface-chosen);
  normal=normalize(normal+vec3(sin(surface.y*13.+time)*.008,sin(surface.x*11.-time)*.008,0.)*burst);
  vec3 base=tint;
  if(member>6.5) base=mix(tint,vec3(.64,.48,.23),.65);
  float light=max(dot(normal,normalize(vec3(-.6,.9,1.))),0.);
  float fresnel=pow(1.-max(dot(normal,-rd),0.),3.);
  vec3 reflected=reflect(rd,normal);
  vec3 c=base*(.08+light*.40)+environment(reflected)*(.35+fresnel*.45);
  c+=base*fresnel*.23;
  float occlusion=smoothstep(-.7,.4,normal.y);
  c*=.64+.36*occlusion;
  c=mix(c,c*1.18+.015,1.-dark);
  color=vec4(c,1.);
}`;

export function JourneyOrb({
  progress,
  staticScene = 0,
  arrival,
}: {
  progress: MotionValue<number>;
  staticScene?: number;
  arrival?: MotionValue<number>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const interaction = useRef({ x: 0, y: 0, burst: 0 });
  const pointerBounds = useRef<DOMRect | null>(null);
  const wake = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setFallback(true);
      return;
    }
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let visible = false;
    let lost = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      program = gl.createProgram()!;
      for (const [type, source] of [
        [gl.VERTEX_SHADER, VERTEX],
        [gl.FRAGMENT_SHADER, FRAGMENT],
      ] as const) {
        const shader = gl.createShader(type)!;
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error("Orb shader unavailable");
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Orb material unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch {
      setFallback(true);
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      return;
    }
    const uniforms = Object.fromEntries(
      [
        "resolution",
        "pointer",
        "progress",
        "time",
        "burst",
        "tint",
        "dark",
        "compact",
        "arrival",
      ].map((name) => [name, gl.getUniformLocation(program!, name)]),
    );
    let width = 1,
      height = 1;
    let px = 0,
      py = 0,
      pulse = 0;
    let last = 0,
      elapsed = 0;
    const draw = (now: number) => {
      frame = 0;
      if (lost || !visible || document.hidden) return;
      const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
      last = now;
      elapsed += dt;
      const follow = 1 - Math.exp(-dt * 10);
      px += (interaction.current.x - px) * follow;
      py += (interaction.current.y - py) * follow;
      pulse += (interaction.current.burst - pulse) * follow;
      interaction.current.burst *= Math.exp(-dt * 3);
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform2f(uniforms.pointer, still ? 0 : px, still ? 0 : py);
      gl.uniform1f(uniforms.progress, still ? staticScene / 7 : progress.get());
      gl.uniform1f(uniforms.arrival, arrival?.get() ?? 1);
      gl.uniform1f(uniforms.time, still ? 0 : elapsed);
      gl.uniform1f(uniforms.burst, still ? 0 : pulse);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      const phase = progress.get() * 7;
      const tracking =
        Math.abs(px - interaction.current.x) + Math.abs(py - interaction.current.y) > 0.001;
      if (
        !still &&
        (phase < 1 ||
          phase > 5.25 ||
          tracking ||
          pulse > 0.004 ||
          interaction.current.burst > 0.004)
      )
        frame = requestAnimationFrame(draw);
    };
    const start = () => {
      if (visible && !document.hidden && !lost && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      } else if (!visible || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    wake.current = start;
    const unsubscribe = progress.on("change", start);
    const unsubscribeArrival = arrival?.on("change", start);
    const theme = () => {
      const root = document.documentElement;
      const token = getComputedStyle(root).getPropertyValue("--primary").trim();
      const sampler = document
        .createElement("canvas")
        .getContext("2d", { willReadFrequently: true })!;
      sampler.fillStyle = token;
      sampler.fillRect(0, 0, 1, 1);
      const [r, g, b] = sampler.getImageData(0, 0, 1, 1).data;
      gl.uniform3f(uniforms.tint, r / 255, g / 255, b / 255);
      gl.uniform1f(uniforms.dark, root.classList.contains("dark") ? 1 : 0);
      start();
    };
    const resize = new ResizeObserver(([entry]) => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        window.matchMedia("(pointer: coarse)").matches ? 1 : 1.5,
      );
      gl.uniform1f(uniforms.compact, window.innerWidth < 768 ? 1 : 0);
      pointerBounds.current = null;
      width = element.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      height = element.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      start();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    const themes = new MutationObserver(theme);
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      setFallback(true);
    };
    theme();
    resize.observe(element);
    observer.observe(element);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", start);
    element.addEventListener("webglcontextlost", contextLost);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      unsubscribeArrival?.();
      wake.current = () => {};
      resize.disconnect();
      observer.disconnect();
      themes.disconnect();
      document.removeEventListener("visibilitychange", start);
      element.removeEventListener("webglcontextlost", contextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
  }, [progress, staticScene, arrival]);

  return (
    <button
      type="button"
      className="journey-orb"
      aria-label="Scatter the example group of friends"
      onPointerEnter={(event) => {
        pointerBounds.current = event.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const rect = pointerBounds.current;
        if (!rect) return;
        const pull = event.buttons === 1 ? 5 : 1;
        interaction.current.x = (((event.clientX - rect.left) / rect.width) * 2 - 1) * pull;
        interaction.current.y = (1 - ((event.clientY - rect.top) / rect.height) * 2) * pull;
        wake.current();
      }}
      onPointerDown={(event) => {
        pointerBounds.current = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        interaction.current.burst = 1.6;
        wake.current();
      }}
      onPointerUp={() => {
        interaction.current.x = 0;
        interaction.current.y = 0;
        wake.current();
      }}
      onPointerCancel={() => {
        interaction.current.x = 0;
        interaction.current.y = 0;
        wake.current();
      }}
      onPointerLeave={() => {
        interaction.current.x = 0;
        interaction.current.y = 0;
        wake.current();
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          interaction.current.burst = 1.6;
          wake.current();
        }
      }}
    >
      {fallback ? (
        <span className="journey-orb__fallback" aria-hidden="true" />
      ) : (
        <canvas ref={canvas} aria-hidden="true" />
      )}
    </button>
  );
}
