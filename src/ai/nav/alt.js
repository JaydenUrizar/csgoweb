// ALT landmarks (A*, Landmarks, Triangle inequality): per-node distances to/from K far-apart landmarks give a much tighter
// admissible heuristic than Euclid on maze-like maps, so long routes expand a few hundred nodes instead of thousands.
import { MinHeap } from './regions.js';

export const ALT_K = 8;

/** Generator: computes g.alt = {k, F, B} (node-major Float32Arrays); yields between landmarks. */
export function* computeALT(g, K = ALT_K) {
  const N = g.N; if (N < 64) { g.alt = null; return; }
  const nb = g.nb, nbc = g.nbc, lstart = g.lstart, lto = g.lto, lcost = g.lcost;
  // reverse links CSR
  const L = lto.length, rstart = new Int32Array(N + 1), rfrom = new Int32Array(L), rcost = new Float32Array(L);
  for (let u = 0; u < N; u++) for (let p = lstart[u]; p < lstart[u + 1]; p++) rstart[lto[p] + 1]++;
  for (let i = 0; i < N; i++) rstart[i + 1] += rstart[i];
  const fill = rstart.slice(0, N);
  for (let u = 0; u < N; u++) for (let p = lstart[u]; p < lstart[u + 1]; p++) { const q = fill[lto[p]]++; rfrom[q] = u; rcost[q] = lcost[p]; }
  const heap = new MinHeap(4096);
  const D = new Float64Array(N);
  const run = (src, reverse) => {   // fills D with distances from/to src
    D.fill(Infinity); heap.clear(); D[src] = 0; heap.push(0, src);
    while (heap.n) {
      const u = heap.pop(), key = heap.popKey; if (key > D[u]) continue;
      for (let k = 0; k < 8; k++) {
        const v = nb[u * 8 + k]; if (v < 0) continue;
        if (reverse && nb[v * 8 + ((k + 4) & 7)] !== u) continue;     // v->u must exist
        const d = key + (reverse ? nbc[v * 8 + ((k + 4) & 7)] : nbc[u * 8 + k]);
        if (d < D[v]) { D[v] = d; heap.push(d, v); }
      }
      if (reverse) { for (let p = rstart[u]; p < rstart[u + 1]; p++) { const v = rfrom[p], d = key + rcost[p]; if (d < D[v]) { D[v] = d; heap.push(d, v); } } }
      else { for (let p = lstart[u]; p < lstart[u + 1]; p++) { const v = lto[p], d = key + lcost[p]; if (d < D[v]) { D[v] = d; heap.push(d, v); } } }
    }
  };
  const F = new Float32Array(N * K), B = new Float32Array(N * K), minD = new Float32Array(N).fill(Infinity);
  let src = 0;
  run(0, false); let best = 0, bd = -1; for (let i = 0; i < N; i++) { const d = D[i]; if (d < Infinity && d > bd) { bd = d; best = i; } }
  src = best;
  for (let l = 0; l < K; l++) {
    run(src, false); for (let i = 0; i < N; i++) { F[i * K + l] = D[i]; if (D[i] < minD[i]) minD[i] = D[i]; }
    yield (l + 0.5) / K;
    run(src, true); for (let i = 0; i < N; i++) { B[i * K + l] = D[i]; if (D[i] < minD[i]) minD[i] = D[i]; }
    let nx = 0, nd = -1; for (let i = 0; i < N; i++) if (minD[i] < Infinity && minD[i] > nd) { nd = minD[i]; nx = i; }
    src = nx; yield (l + 1) / K;
  }
  g.alt = { k: K, F, B };
}
