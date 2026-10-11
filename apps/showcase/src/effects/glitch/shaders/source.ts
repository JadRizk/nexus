/** The picture fed into the effects: the graph, bars or console, picked by `uMode`. */
export const SRC_FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform int uMode;
// Offsets every hash that places the graph, so each seed is a new layout.
// 0 is the layout Glitch Lab has always shown.
uniform float uSeed;
varying vec2 vUv;

float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

float seg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h);
}

vec3 graph(vec2 uv){
  vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;
  vec3 col = vec3(0.012, 0.016, 0.014);

  // parallax grid floor
  float g = 0.0;
  vec2 q = p * 6.0;
  g += smoothstep(0.045, 0.0, abs(fract(q.x)-0.5)-0.47);
  g += smoothstep(0.045, 0.0, abs(fract(q.y)-0.5)-0.47);
  col += vec3(0.10,0.13,0.06) * g * 0.10;

  // 22 nodes on a hashed lattice, breathing
  for (int i = 0; i < 22; i++){
    float fi = float(i);
    float k = fi + uSeed;
    vec2 c = vec2(h1(k*1.7)*2.0-1.0, h1(k*3.1+7.0)*2.0-1.0) * 1.35;
    c += 0.06*vec2(sin(uTime*0.4+fi), cos(uTime*0.33+fi*1.7));
    float r = 0.030 + 0.020*h1(k*5.3);
    r *= 1.0 + 0.09*sin(uTime*1.4 + fi*2.0);
    float d = length(p - c);

    vec3 tint = fi < 3.0 ? vec3(0.78,0.95,0.21)      // acid  — atlases
              : fi < 6.0 ? vec3(1.0,0.18,0.39)        // alarm — unresolved
              : fi < 10.0 ? vec3(1.0,0.54,0.12)       // sodium — sources
              : vec3(0.09,0.89,0.90);                 // data — nodes

    col += tint * smoothstep(r, r*0.55, d) * 0.55;                    // core
    col += tint * smoothstep(r*1.28, r*1.05, d) * smoothstep(r*0.98, r*1.2, d) * 2.2; // rim
    col += tint * pow(max(0.0, 1.0 - d/(r*7.0)), 4.0) * 0.30;         // halo

    // one link per node, so there is real edge detail for artifacts to chew on
    float k2 = mod(fi*7.0+3.0,22.0) + uSeed;
    vec2 c2 = vec2(h1(k2*1.7)*2.0-1.0,
                   h1(k2*3.1+7.0)*2.0-1.0) * 1.35;
    float ld = seg(p, c, c2);
    float pkt = exp(-pow((fract(dot(p-c, normalize(c2-c))/length(c2-c) - uTime*0.25 + h1(k))-0.5)*13.0, 2.0));
    col += vec3(0.14,0.55,0.62) * smoothstep(0.006, 0.0, ld) * 0.9;
    col += vec3(0.6,1.0,1.0) * smoothstep(0.004, 0.0, ld) * pkt * 1.4;
  }
  return col;
}

vec3 bars(vec2 uv){
  // SMPTE-ish bars over a zone plate. The fine radial detail is what makes
  // chroma bleed and dot crawl legible — flat colour hides both.
  vec3 c;
  float x = uv.x;
  if (uv.y > 0.34) {
    if (x < 0.143) c = vec3(0.75);
    else if (x < 0.286) c = vec3(0.75,0.75,0.0);
    else if (x < 0.429) c = vec3(0.0,0.75,0.75);
    else if (x < 0.571) c = vec3(0.0,0.75,0.0);
    else if (x < 0.714) c = vec3(0.75,0.0,0.75);
    else if (x < 0.857) c = vec3(0.75,0.0,0.0);
    else c = vec3(0.0,0.0,0.75);
  } else if (uv.y > 0.24) {
    c = vec3(0.0,0.0,0.75) * step(0.5, fract(x*7.0));
    c += vec3(0.75,0.0,0.0) * step(0.5, fract(x*7.0+0.5));
  } else {
    vec2 p = (uv - vec2(0.5,0.12)) * vec2(uRes.x/uRes.y, 1.0);
    float zp = 0.5 + 0.5*sin(dot(p,p) * 900.0);
    c = vec3(zp);
    c *= smoothstep(0.42, 0.10, length(p));
    c += vec3(0.78,0.95,0.21) * step(0.985, fract(uv.x*12.0 - uTime*0.4)) * 0.6;
  }
  return c;
}

vec3 console_(vec2 uv){
  vec3 col = vec3(0.012,0.016,0.014);
  // stacked HUD rows: high-contrast rectangles and hairlines
  for (int r = 0; r < 14; r++){
    float fr = float(r);
    float y0 = 0.06 + fr*0.064;
    if (uv.y > y0 && uv.y < y0+0.030) {
      float w = 0.12 + h1(fr)*0.55;
      float scroll = fract(uTime*0.05 + h1(fr*3.0));
      if (uv.x > 0.06 && uv.x < 0.06+w) {
        float cells = step(0.35, fract((uv.x-0.06)*90.0));
        vec3 tint = h1(fr*9.0) > 0.82 ? vec3(1.0,0.18,0.39) : vec3(0.78,0.95,0.21);
        col += tint * cells * (0.35 + 0.65*step(scroll, (uv.x-0.06)/w));
      }
      if (uv.x > 0.68 && uv.x < 0.94) {
        col += vec3(0.09,0.89,0.90) * step(0.5, fract(uv.x*120.0)) * 0.5;
      }
    }
    if (abs(uv.y - (y0+0.046)) < 0.0012) col += vec3(0.10,0.14,0.08);
  }
  return col;
}

void main(){
  vec2 uv = vUv;
  vec3 col = uMode == 0 ? graph(uv) : uMode == 1 ? bars(uv) : console_(uv);
  gl_FragColor = vec4(col, 1.0);
}`;
