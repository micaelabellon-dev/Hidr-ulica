/**
 * Mezcla rápida (coagulación).
 *
 * Placa orificio en tubería:
 *   A = Q/v ; D = √(4A/π) ; d = D/β ;
 *   h = Q²·(β⁴ − 1) / (3,48²·Cd²·D⁴)      (3,48 = (π/4)·√(2g))
 *   hf = % · h  (pérdida permanente) ;  G = √(g·Q·hf / (ν·V)), V = A_D · (k·D)
 *
 * Canaleta Parshall con resalto hidráulico:
 *   Ha = k·Q^n ; D' = (2/3)(D − W) + W ; Va = Q/(D'·Ha) ; q = Q/W
 *   E0 = Va²/2g + Ha + N
 *   cos θ = −q·g / ((2/3)·g·E0)^1,5 ; V1 = 2·√((2/3)·g·E0)·cos(θ/3)
 *   h1 = q/V1 ; Fr1 = V1/√(g·h1) ; h2 = (h1/2)(√(1 + 8·Fr1²) − 1)
 *   V2 = Q/(W·h2) ; h3 = h2 − (N − K) ; V3 = Q/(C·h3)
 *   hp = Ha + K − h3 ; T = 2·G'/(V2 + V3) ; G = √(g·hp/(ν·T))
 */

export interface DatosOrificio {
  caudalM3s: number;
  velocidadMs: number;
  diametroAdoptadoM: number | null;
  beta: number; // D/d
  cd: number;
  perdidaPermanente: number; // fracción de h
  largoMezclaDiametros: number;
  nu: number;
  g: number;
}

export function placaOrificio(d: DatosOrificio) {
  const area = d.caudalM3s / d.velocidadMs;
  const diametroTeorico = Math.sqrt((4 * area) / Math.PI);
  const D = d.diametroAdoptadoM ?? diametroTeorico;
  const dOrificio = D / d.beta;
  const h = (d.caudalM3s ** 2 * (d.beta ** 4 - 1)) / (3.48 ** 2 * d.cd ** 2 * D ** 4);
  const hf = d.perdidaPermanente * h;
  const largo = d.largoMezclaDiametros * D;
  const volumen = ((Math.PI * D ** 2) / 4) * largo;
  const G = Math.sqrt((d.g * d.caudalM3s * hf) / (d.nu * volumen));
  const tiempo = volumen / d.caudalM3s;
  return { area, diametroTeorico, D, dOrificio, h, hf, largo, volumen, G, tiempo, velocidadReal: d.caudalM3s / ((Math.PI * D ** 2) / 4) };
}

export interface MedidaParshall {
  nombre: string;
  W: number;
  k: number;
  n: number;
  D: number;
  N: number;
  C: number;
  G: number;
  K: number;
}

/** Medidas normalizadas de canaletas Parshall (m) con k y n para Q en m³/s. */
export const PARSHALL: readonly MedidaParshall[] = [
  { nombre: '3"', W: 0.0762, k: 3.704, n: 0.646, D: 0.259, N: 0.057, C: 0.178, G: 0.305, K: 0.057 },
  { nombre: '9"', W: 0.228, k: 1.486, n: 0.633, D: 0.575, N: 0.114, C: 0.381, G: 0.457, K: 0.076 },
  { nombre: "1'", W: 0.3048, k: 1.276, n: 0.657, D: 0.845, N: 0.229, C: 0.61, G: 0.941, K: 0.076 },
  { nombre: "1,5'", W: 0.4572, k: 0.966, n: 0.65, D: 1.026, N: 0.229, C: 0.762, G: 0.941, K: 0.076 },
  { nombre: "2'", W: 0.6096, k: 0.795, n: 0.645, D: 1.206, N: 0.229, C: 0.914, G: 0.941, K: 0.076 },
];

export function parshall(m: MedidaParshall, Q: number, g = 9.8, nu = 1e-6) {
  const Ha = m.k * Q ** m.n;
  const Dp = (2 / 3) * (m.D - m.W) + m.W;
  const Va = Q / (Dp * Ha);
  const q = Q / m.W;
  const E0 = Va ** 2 / (2 * g) + Ha + m.N;
  const cosTheta = (-q * g) / ((2 / 3) * g * E0) ** 1.5;
  const theta = Math.acos(cosTheta);
  const V1 = 2 * Math.sqrt((2 / 3) * g * E0) * Math.cos(theta / 3);
  const h1 = q / V1;
  const Fr1 = V1 / Math.sqrt(g * h1);
  const h2 = (h1 / 2) * (Math.sqrt(1 + 8 * Fr1 ** 2) - 1);
  const V2 = Q / (m.W * h2);
  const h3 = h2 - (m.N - m.K);
  const V3 = Q / (m.C * h3);
  const hp = Ha + m.K - h3;
  const T = (2 * m.G) / (V2 + V3);
  const G = Math.sqrt((g * hp) / (nu * T));
  return { Ha, Dp, Va, q, E0, cosTheta, theta, V1, h1, Fr1, h2, V2, h3, V3, hp, T, G };
}
