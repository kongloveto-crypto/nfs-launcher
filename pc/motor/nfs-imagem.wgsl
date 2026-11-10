// Pacotes de imagem do NFS Launcher: rodam no motor, sobre a imagem pronta do jogo (aplicar-correcoes.py poe este
// arquivo dentro de webgpu_texture_alpha_clearer.cc). O app escolhe os valores por CSS no canvas do jogo:
//   #game { --nfs-image: fxaa nitidez saturacao vibrance contraste brilho gama vinheta r g b bloom limiar sepia }
// Sem a linha, ou com tudo no valor neutro, nenhum passo roda. Contas no mesmo espaco de cor dos filtros CSS (sRGB).
struct P {
  a: vec4f,  // fxaa (0/1), nitidez (0..1), saturacao (1 = igual), vibrance (0 = igual)
  b: vec4f,  // contraste (1), brilho (1), gama (1), vinheta (0)
  c: vec4f,  // ganho de vermelho, verde e azul (1), bloom (0 = sem)
  d: vec4f,  // limiar do bloom, sepia (0), livre, livre
}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var<uniform> p: P;
@group(0) @binding(3) var glow: texture_2d<f32>;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var q = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(q[i], 0, 1);
}
const PESO = vec3f(0.213, 0.715, 0.072);
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
fn am(uv: vec2f) -> vec3f { return textureSampleLevel(src, smp, uv, 0.0).rgb; }

// ───── Anti-serrilhado (FXAA), o mesmo medido em 03/11 (RTX 4060, 1440p: ~0,21 ms por quadro) ─────
const LIMIAR_MIN = 0.0312;
const LIMIAR = 0.125;
const SUBPIXEL = 0.5;
@fragment fn fs_fxaa(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  var Q = array<f32, 10>(1.0, 1.0, 1.0, 1.0, 1.5, 2.0, 2.0, 2.0, 4.0, 8.0);
  let inv = 1.0 / vec2f(textureDimensions(src));
  let uv = pos.xy * inv;
  let cor = am(uv);
  let c = lum(cor);
  let n = lum(am(uv + vec2f(0.0, -inv.y)));
  let s = lum(am(uv + vec2f(0.0, inv.y)));
  let l = lum(am(uv + vec2f(inv.x, 0.0)));
  let o = lum(am(uv + vec2f(-inv.x, 0.0)));
  let mn = min(c, min(n, min(s, min(l, o))));
  let mx = max(c, max(n, max(s, max(l, o))));
  let faixa = mx - mn;
  if (faixa < max(LIMIAR_MIN, mx * LIMIAR)) { return vec4f(cor, 1.0); }
  let no = lum(am(uv + vec2f(-inv.x, -inv.y)));
  let ne = lum(am(uv + vec2f(inv.x, -inv.y)));
  let so = lum(am(uv + vec2f(-inv.x, inv.y)));
  let se = lum(am(uv + vec2f(inv.x, inv.y)));
  let bordaH = abs(-2.0 * o + no + so) + abs(-2.0 * c + n + s) * 2.0 + abs(-2.0 * l + ne + se);
  let bordaV = abs(-2.0 * n + no + ne) + abs(-2.0 * c + o + l) * 2.0 + abs(-2.0 * s + so + se);
  let horizontal = bordaH >= bordaV;
  var passo = select(inv.x, inv.y, horizontal);
  let l1 = select(o, n, horizontal);
  let l2 = select(l, s, horizontal);
  let g1 = l1 - c;
  let g2 = l2 - c;
  let forte1 = abs(g1) >= abs(g2);
  let gMin = 0.25 * max(abs(g1), abs(g2));
  var media = 0.5 * (l2 + c);
  if (forte1) { passo = -passo; media = 0.5 * (l1 + c); }
  var base = uv;
  if (horizontal) { base.y += passo * 0.5; } else { base.x += passo * 0.5; }
  let dir = select(vec2f(0.0, inv.y), vec2f(inv.x, 0.0), horizontal);
  var uv1 = base - dir;
  var uv2 = base + dir;
  var f1 = lum(am(uv1)) - media;
  var f2 = lum(am(uv2)) - media;
  var fim1 = abs(f1) >= gMin;
  var fim2 = abs(f2) >= gMin;
  for (var i = 1; i < 10 && !(fim1 && fim2); i++) {
    if (!fim1) { uv1 -= dir * Q[i]; f1 = lum(am(uv1)) - media; fim1 = abs(f1) >= gMin; }
    if (!fim2) { uv2 += dir * Q[i]; f2 = lum(am(uv2)) - media; fim2 = abs(f2) >= gMin; }
  }
  let d1 = select(uv.y - uv1.y, uv.x - uv1.x, horizontal);
  let d2 = select(uv2.y - uv.y, uv2.x - uv.x, horizontal);
  let perto1 = d1 < d2;
  let dist = min(d1, d2);
  let extremo = select(f2, f1, perto1);
  let certo = (extremo < 0.0) != (c < media);
  var desloc = select(0.0, 0.5 - dist / (d1 + d2), certo);
  let mediaTudo = (2.0 * (n + s + l + o) + no + ne + so + se) / 12.0;
  let sub1 = clamp(abs(mediaTudo - c) / faixa, 0.0, 1.0);
  let sub2 = (-2.0 * sub1 + 3.0) * sub1 * sub1;
  desloc = max(desloc, sub2 * sub2 * SUBPIXEL);
  var fim = uv;
  if (horizontal) { fim.y += desloc * passo; } else { fim.x += desloc * passo; }
  return vec4f(am(fim), 1.0);
}

// ───── Bloom: so o que brilha, numa imagem com 1/4 do tamanho, borrada em dois passos ─────
@fragment fn fs_down(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let inv = 1.0 / vec2f(textureDimensions(src));
  let uv = pos.xy * 4.0 * inv;
  let c = (am(uv + vec2f(-inv.x, -inv.y)) + am(uv + vec2f(inv.x, -inv.y)) +
           am(uv + vec2f(-inv.x, inv.y)) + am(uv + vec2f(inv.x, inv.y))) * 0.25;
  let k = clamp((max(c.r, max(c.g, c.b)) - p.d.x) / max(1.0 - p.d.x, 0.001), 0.0, 1.0);
  return vec4f(c * k * k, 1.0);
}
fn borrao(uv: vec2f, d: vec2f) -> vec3f {
  return am(uv) * 0.227027 + (am(uv + d * 1.384615) + am(uv - d * 1.384615)) * 0.316216 +
         (am(uv + d * 3.230769) + am(uv - d * 3.230769)) * 0.070270;
}
// Dois borroes seguidos (o segundo com passo dobrado): brilho mais largo sem falhas.
fn passo(q: vec2f, k: f32) -> vec2f { return q * k / vec2f(textureDimensions(src)); }
fn ponto(pos: vec4f) -> vec2f { return pos.xy / vec2f(textureDimensions(src)); }
@fragment fn fs_blur_h(@builtin(position) pos: vec4f) -> @location(0) vec4f { return vec4f(borrao(ponto(pos), passo(vec2f(1.0, 0.0), 1.0)), 1.0); }
@fragment fn fs_blur_v(@builtin(position) pos: vec4f) -> @location(0) vec4f { return vec4f(borrao(ponto(pos), passo(vec2f(0.0, 1.0), 1.0)), 1.0); }
@fragment fn fs_blur_h2(@builtin(position) pos: vec4f) -> @location(0) vec4f { return vec4f(borrao(ponto(pos), passo(vec2f(1.0, 0.0), 2.0)), 1.0); }
@fragment fn fs_blur_v2(@builtin(position) pos: vec4f) -> @location(0) vec4f { return vec4f(borrao(ponto(pos), passo(vec2f(0.0, 1.0), 2.0)), 1.0); }

// ───── Passo final: nitidez (CAS, da AMD), bloom e cor ─────
@fragment fn fs_grade(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let inv = 1.0 / vec2f(textureDimensions(src));
  let uv = pos.xy * inv;
  var c = am(uv);
  if (p.a.y > 0.0) {
    let n = am(uv + vec2f(0.0, -inv.y));
    let s = am(uv + vec2f(0.0, inv.y));
    let l = am(uv + vec2f(inv.x, 0.0));
    let o = am(uv + vec2f(-inv.x, 0.0));
    let mn = min(c, min(min(n, s), min(l, o)));
    let mx = max(c, max(max(n, s), max(l, o)));
    let amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3f(0.0001)), vec3f(0.0), vec3f(1.0)));
    let w = amp * (-1.0 / mix(8.0, 5.0, p.a.y));
    c = clamp((c + (n + s + l + o) * w) / (1.0 + 4.0 * w), vec3f(0.0), vec3f(1.0));
  }
  if (p.c.w > 0.0) {
    let g = clamp(textureSampleLevel(glow, smp, uv, 0.0).rgb * p.c.w, vec3f(0.0), vec3f(1.0));
    c = 1.0 - (1.0 - c) * (1.0 - g);
  }
  if (p.d.y > 0.0) {
    let sp = vec3f(dot(c, vec3f(0.393, 0.769, 0.189)), dot(c, vec3f(0.349, 0.686, 0.168)), dot(c, vec3f(0.272, 0.534, 0.131)));
    c = mix(c, sp, p.d.y);
  }
  c = mix(vec3f(dot(c, PESO)), c, p.a.z);
  if (p.a.w != 0.0) {
    let viva = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3f(dot(c, PESO)), c, 1.0 + p.a.w * (1.0 - viva));
  }
  c = (c - 0.5) * p.b.x + 0.5;
  c = clamp(c * p.b.y, vec3f(0.0), vec3f(1.0));
  c = pow(c, vec3f(p.b.z)) * p.c.rgb;
  if (p.b.w > 0.0) {
    let q = (uv - 0.5) * 2.0;
    c *= 1.0 - p.b.w * smoothstep(0.45, 1.6, dot(q, q));
  }
  return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
