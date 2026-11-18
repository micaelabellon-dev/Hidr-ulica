/**
 * Sedimentación.
 *
 * Decantador convencional: A = Q/CS ; V = A·H ; t = V/Q ; vh = Q/(B·H) ;
 * carga sobre vertedero = Q / L vertedero.
 * Remoción en sedimentación primaria (Metcalf & Eddy): R = t/(a + b·t), t en h;
 * DBO a = 0,018 b = 0,020 ; SST a = 0,0075 b = 0,014.
 *
 * Decantador laminar de placas (Yao):  vsc = v0 / (sen θ + L'·cos θ)
 *   L = l/e ;  L' = L − 0,058·v0·e/ν (zona de transición) ; Re = v0·e/ν < 500
 *   A superficial = Q / (v0·sen θ)
 *
 * Velocidad de sedimentación de Stokes: vs = g·(ρp − ρ)·d² / (18·μ).
 */

export interface DatosConvencional {
  caudalM3d: number;
  cargaSuperficialM3m2d: number;
  profundidadM: number;
  forma: "rectangular" | "circular";
  relacionLB: number;
  unidades: number;
  largoVertederoM: number | null;
}

export function decantadorConvencional(d: DatosConvencional) {
  const qUnidad = d.caudalM3d / d.unidades;
  const area = qUnidad / d.cargaSuperficialM3m2d;
  let largo = NaN;
  let ancho = NaN;
  let diametro = NaN;
  if (d.forma === "rectangular") {
    ancho = Math.sqrt(area / d.relacionLB);
    largo = d.relacionLB * ancho;
  } else {
    diametro = Math.sqrt((4 * area) / Math.PI);
  }
  const volumen = area * d.profundidadM;
  const tiempoH = (volumen / qUnidad) * 24;
  const vh = d.forma === "rectangular" ? qUnidad / 86400 / (ancho * d.profundidadM) : NaN;
  const lVert = d.largoVertederoM ?? (d.forma === "rectangular" ? ancho : Math.PI * diametro);
  const cargaVertedero = qUnidad / lVert;
  const remDbo = tiempoH / (0.018 + 0.02 * tiempoH);
  const remSst = tiempoH / (0.0075 + 0.014 * tiempoH);
  return { qUnidad, area, largo, ancho, diametro, volumen, tiempoH, vh, lVert, cargaVertedero, remDbo, remSst };
}

export interface DatosLaminar {
  caudalM3d: number;
  vscMd: number; // carga superficial crítica de diseño
  espaciamientoM: number; // e (perpendicular)
  largoPlacaM: number;
  anguloGrados: number;
  nu: number;
}

export function decantadorLaminar(d: DatosLaminar) {
  const th = (d.anguloGrados * Math.PI) / 180;
  const L = d.largoPlacaM / d.espaciamientoM;
  const vsc = d.vscMd / 86400;
  let v0 = vsc * (Math.sin(th) + L * Math.cos(th));
  let Lp = L;
  for (let i = 0; i < 100; i++) {
    Lp = L - (0.058 * v0 * d.espaciamientoM) / d.nu;
    const nuevo = vsc * (Math.sin(th) + Lp * Math.cos(th));
    if (Math.abs(nuevo - v0) < 1e-12) break;
    v0 = nuevo;
  }
  const re = (v0 * d.espaciamientoM) / d.nu;
  const area = d.caudalM3d / 86400 / (v0 * Math.sin(th));
  return { L, Lp, v0, v0Md: v0 * 86400, re, area, tiempoPlacasMin: d.largoPlacaM / v0 / 60, cargaAparente: d.caudalM3d / area };
}

export function stokes(diametroM: number, densidadParticula: number, densidadAgua = 998.2, mu = 1.002e-3, g = 9.81) {
  const vs = (g * (densidadParticula - densidadAgua) * diametroM ** 2) / (18 * mu);
  const re = (densidadAgua * vs * diametroM) / mu;
  return { vs, re };
}
