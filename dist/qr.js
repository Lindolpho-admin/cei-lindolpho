/* v68: gerador de QR code (modo byte, correção L, versões 1 a 15) para o Pix da página de fotos. Sem biblioteca. */
(function (g) {
  const TAB = [null, [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]], [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]], [20, [[4, 81]]], [24, [[2, 92], [2, 93]]], [26, [[4, 107]]], [30, [[3, 115], [1, 116]]], [22, [[5, 87], [1, 88]]]];
  const ALIN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70]];
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  function rs(dados, n) {
    let gen = [1];
    for (let i = 0; i < n; i++) { const nx = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { nx[j] ^= c; nx[j + 1] ^= mul(c, EXP[i]); }); gen = nx; }
    const r = new Array(n).fill(0);
    for (const b of dados) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < n; i++) r[i] ^= mul(gen[i + 1], f); }
    return r;
  }
  function bch(v, poli, bits) { let r = v << bits; const t = 32 - Math.clz32(poli); for (let i = 32 - Math.clz32(r) - t; i >= 0; i--) if ((r >> (i + t - 1)) & 1) r ^= poli << i; return r; }
  function qr(texto, forcar) {
    const bytes = new TextEncoder().encode(texto);
    let v = 1;
    for (; v <= 15; v++) { const cw = TAB[v][1].reduce((s, [n, d]) => s + n * d, 0); if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cw * 8) break; }
    if (v > 15) throw new Error('Texto grande demais para o QR code.');
    const [ecn, grupos] = TAB[v], total = grupos.reduce((s, [n, d]) => s + n * d, 0), bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, total * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; cw.length < total; p ^= 1) cw.push(p ? 0x11 : 0xec);
    const blocos = []; let k = 0;
    for (const [n, d] of grupos) for (let i = 0; i < n; i++) { const dt = cw.slice(k, k + d); k += d; blocos.push({dt, ec: rs(dt, ecn)}); }
    const fin = [], maxd = Math.max(...blocos.map(b => b.dt.length));
    for (let i = 0; i < maxd; i++) for (const b of blocos) if (i < b.dt.length) fin.push(b.dt[i]);
    for (let i = 0; i < ecn; i++) for (const b of blocos) fin.push(b.ec[i]);
    const N = 17 + 4 * v, M = Array.from({length: N}, () => new Array(N).fill(false)), F = Array.from({length: N}, () => new Array(N).fill(false));
    const set = (x, y, d) => { if (x >= 0 && y >= 0 && x < N && y < N) { M[y][x] = d; F[y][x] = true; } };
    for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
    const al = ALIN[v];
    for (let a = 0; a < al.length; a++) for (let b = 0; b < al.length; b++) { if ((a === 0 && b === 0) || (a === 0 && b === al.length - 1) || (a === al.length - 1 && b === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[a] + dx, al[b] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    for (let i = 0; i < 9; i++) if (i !== 6) { set(8, i, false); set(i, 8, false); } for (let i = 0; i < 8; i++) { set(N - 1 - i, 8, false); set(8, N - 1 - i, false); }
    set(8, N - 8, true);
    if (v >= 7) { const vi = (v << 12) | bch(v, 0x1f25, 12); for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1, a = N - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, !!b); set(c, a, !!b); } }
    const dados = []; fin.forEach(b => { for (let i = 7; i >= 0; i--) dados.push((b >> i) & 1); });
    let idx = 0; const livre = Array.from({length: N}, () => new Array(N).fill(false));
    for (let x = N - 1; x >= 1; x -= 2) { if (x === 6) x = 5; for (let j = 0; j < N; j++) for (let c = 0; c < 2; c++) { const xx = x - c, up = ((x + 1) & 2) === 0, yy = up ? N - 1 - j : j; if (!F[yy][xx]) { M[yy][xx] = idx < dados.length ? dados[idx] === 1 : false; idx++; livre[yy][xx] = true; } } }
    const MASC = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const formato = (m) => { const fi = (((1 << 3) | m) << 10) | bch((1 << 3) | m, 0x537, 10); const f = fi ^ 0x5412; const bit = i => ((f >> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(i)); set(8, N - 8, true); };
    const penal = () => { let p = 0;
      for (let y = 0; y < N; y++) for (const dir of [0, 1]) { let run = 1, ant = dir ? M[0][y] : M[y][0]; for (let i = 1; i < N; i++) { const c = dir ? M[i][y] : M[y][i]; if (c === ant) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; ant = c; } } }
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) if (M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
      const pad = [true, false, true, true, true, false, true];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const dir of [0, 1]) { if (x + 10 >= N && !dir) continue; if (y + 10 >= N && dir) continue; const at = i => dir ? M[y + i][x] : M[y][x + i]; const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]; let ma = true, mb = true; for (let i = 0; i < 11; i++) { const c = at(i) ? 1 : 0; if (c !== a[i]) ma = false; if (c !== b[i]) mb = false; } if (ma) p += 40; if (mb) p += 40; }
      let esc = 0; for (const r of M) for (const c of r) if (c) esc++; p += Math.floor(Math.abs(esc * 20 - N * N * 10) / (N * N)) * 10; return p; };
    let melhor = null, pm = Infinity;
    for (let m = 0; m < 8; m++) { if (forcar != null && m !== forcar) continue; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (livre[y][x]) M[y][x] = M[y][x] !== MASC[m](x, y); formato(m); const p = penal(); if (p < pm) { pm = p; melhor = M.map(r => r.slice()); }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (livre[y][x]) M[y][x] = M[y][x] !== MASC[m](x, y); }
    return melhor;
  }
  g.cxQR = qr; if (typeof module !== 'undefined') module.exports = qr;
})(typeof window !== 'undefined' ? window : globalThis);
