// Aleatorización de un Diseño en Bloques Completos al Azar (DBCA / RCBD).
// Se ejecuta localmente en el dispositivo para que crear ensayos no requiera
// conexión al backend.

export interface PlotAssignment {
  block: number;
  col: number;
  treatment: number;
}

/** Genera un PRNG determinístico a partir de una semilla (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * RCBD: cada bloque contiene los `nTreatments` tratamientos en orden aleatorio.
 * Si se provee `seed`, el resultado es reproducible.
 */
export function randomizeRCBD(
  nTreatments: number,
  nBlocks: number,
  seed?: number
): PlotAssignment[] {
  if (nTreatments < 2) throw new Error('n_treatments debe ser >= 2');
  if (nBlocks < 2) throw new Error('n_blocks debe ser >= 2');

  const rand = mulberry32(seed ?? Math.floor(Math.random() * 0x7fffffff));
  const plots: PlotAssignment[] = [];

  for (let block = 1; block <= nBlocks; block++) {
    const order = Array.from({ length: nTreatments }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((treatment, idx) => {
      plots.push({ block, col: idx + 1, treatment });
    });
  }

  return plots;
}
