import { calcularPerdidaCarga, G, type MetodoPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";
import type { EspecColumna } from "@/lib/calculadoras/tablas";
import { numeroDeCelda } from "@/lib/calculadoras/tablas";
import { fmt } from "@/lib/calculadoras/formato";

/**
 * Bombeo desde un pozo y elección de la bomba.
 *
 * Altura manométrica total para un nivel del agua en el pozo:
 *   H(Q) = (z_descarga − z_agua) + p_descarga/γ + hf_impulsión(Q) + hf_succión(Q)
 * con las pérdidas de cada tramo por Darcy-Weisbach o Hazen-Williams más ΣK·V²/2g
 * (la misma función que la calculadora de pérdida de carga). La succión sólo
 * existe con bomba de aspiración, instalada fuera del pozo.
 *
 * Curva de la bomba: polinomio de grado 2 o 3 ajustado por mínimos cuadrados a
 * los puntos Q-H del catálogo; ídem Q-η y Q-NPSHr si se cargan.
 *
 * Punto de operación: intersección H_bomba(Q) = H_sistema(Q), por bisección,
 * dentro del rango de caudales de la curva cargada (no se extrapola).
 *
 * NPSH disponible (bomba de aspiración):
 *   NPSHd = p_atm/γ − p_v/γ − h_s − hf_succión(Q)
 * con h_s = z_eje − z_agua (positiva si la bomba está por encima del agua).
 * p_atm según altitud (atmósfera estándar ISA) y p_v según temperatura.
 *
 * Sumergencia (bomba sumergible): S = z_agua − z_admisión, contra la mínima
 * que exige el fabricante.
 *
 * Potencia: P_hidráulica = ρ·g·Q·H;  P_eje = P_hidráulica / η.
 * Rango recomendado: 70 % a 120 % del caudal de máximo rendimiento (región de
 * operación preferida, ANSI/HI 9.6.3). Sin curva de rendimiento se usa el
 * rango de caudales de la curva cargada.
 */

export type TipoBomba = "aspiracion" | "sumergible";

export interface TramoTuberia {
  longitudM: number;
  diametroMm: number;
  rugosidadMm: number;
  hazenC: number;
  sumaK: number;
}

export interface PuntoBomba {
  caudalLs: number;
  alturaM: number;
  rendimientoPct: number | null;
  npshrM: number | null;
}

export interface DatosBombeo {
  tipo: TipoBomba;
  metodo: MetodoPerdidaCarga;
  temperaturaC: number;
  caudalDisenoLs: number;
  cotaNivelMinimoM: number;
  cotaNivelMaximoM: number;
  cotaDescargaM: number;
  /** Presión que se quiere tener en el punto de descarga, en m de columna de agua. */
  presionDescargaM: number;
  impulsion: TramoTuberia;
  /** Sólo con bomba de aspiración. */
  succion: TramoTuberia | null;
  /** Bomba de aspiración: cota del eje de la bomba. */
  cotaEjeBombaM: number;
  altitudMsnm: number;
  /** NPSHr fijo, cuando la curva no trae Q-NPSHr. */
  npshrManualM: number | null;
  /** Margen exigido entre NPSHd y NPSHr. */
  margenNpshM: number;
  /** Bomba sumergible: cota de la admisión (rejilla de entrada). */
  cotaAdmisionM: number;
  sumergenciaMinimaM: number;
  curvaBomba: PuntoBomba[];
  gradoAjuste: 2 | 3;
}

// ── Propiedades del agua y de la atmósfera ─────────────────────────────────

/** Presión de vapor del agua (kPa) y densidad (kg/m³) según temperatura. Tabla de referencia. */
const PROPIEDADES_AGUA: readonly [tempC: number, pvKPa: number, rho: number][] = [
  [0, 0.611, 999.8],
  [5, 0.872, 1000.0],
  [10, 1.228, 999.7],
  [15, 1.705, 999.1],
  [20, 2.338, 998.2],
  [25, 3.169, 997.0],
  [30, 4.246, 995.7],
  [40, 7.384, 992.2],
  [50, 12.35, 988.0],
  [60, 19.94, 983.2],
];

function interpolarTabla(t: number, col: 1 | 2): number {
  const tabla = PROPIEDADES_AGUA;
  if (t <= tabla[0][0]) return tabla[0][col];
  for (let i = 0; i < tabla.length - 1; i++) {
    if (t <= tabla[i + 1][0]) {
      const f = (t - tabla[i][0]) / (tabla[i + 1][0] - tabla[i][0]);
      return tabla[i][col] + f * (tabla[i + 1][col] - tabla[i][col]);
    }
  }
  return tabla[tabla.length - 1][col];
}

export const presionVaporKPa = (tempC: number) => interpolarTabla(tempC, 1);
export const densidadAgua = (tempC: number) => interpolarTabla(tempC, 2);

/** Atmósfera estándar: p = 101,325·(1 − 2,25577×10⁻⁵·z)^5,25588 kPa. */
export function presionAtmosfericaKPa(altitudM: number): number {
  return 101.325 * Math.pow(1 - 2.25577e-5 * altitudM, 5.25588);
}

// ── Ajuste polinómico ──────────────────────────────────────────────────────

export interface Polinomio {
  /** Coeficientes a0 + a1·x + a2·x² + … */
  coef: number[];
  r2: number;
}

export function evaluarPolinomio(coef: readonly number[], x: number): number {
  let y = 0;
  for (let i = coef.length - 1; i >= 0; i--) y = y * x + coef[i];
  return y;
}

/** Mínimos cuadrados por ecuaciones normales, resueltas por Gauss con pivoteo parcial. */
export function ajustarPolinomio(x: readonly number[], y: readonly number[], grado: number): Polinomio {
  const n = grado + 1;
  // Se escala x para que la matriz quede bien condicionada (x ~ 1).
  const escala = Math.max(...x.map(Math.abs)) || 1;
  const xs = x.map((v) => v / escala);
  const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (let k = 0; k < xs.length; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += xs[k] ** (i + j);
      A[i][n] += y[k] * xs[k] ** i;
    }
  }
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || A[c][c] === 0) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const coef = A.map((fila, i) => fila[n] / fila[i] / escala ** i);

  const media = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - media) ** 2, 0);
  const ssRes = y.reduce((s, v, k) => s + (v - evaluarPolinomio(coef, x[k])) ** 2, 0);
  return { coef, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

// ── Sistema ────────────────────────────────────────────────────────────────

export interface PerdidasTramo {
  velocidadMs: number;
  friccionM: number;
  localizadaM: number;
  totalM: number;
  factorFriccion: number | null;
  reynolds: number | null;
}

export function perdidasTramo(
  tramo: TramoTuberia,
  caudalLs: number,
  metodo: MetodoPerdidaCarga,
  temperaturaC: number
): PerdidasTramo {
  if (caudalLs <= 0) {
    return { velocidadMs: 0, friccionM: 0, localizadaM: 0, totalM: 0, factorFriccion: null, reynolds: null };
  }
  const r = calcularPerdidaCarga({ metodo, caudalLs, temperaturaC, ...tramo });
  return {
    velocidadMs: r.velocidadMs,
    friccionM: r.perdidaFriccionM,
    localizadaM: r.perdidaLocalizadaM,
    totalM: r.perdidaTotalM,
    factorFriccion: r.factorFriccion,
    reynolds: r.reynolds,
  };
}

export function alturaEstatica(datos: DatosBombeo, cotaAguaM: number): number {
  return datos.cotaDescargaM - cotaAguaM + datos.presionDescargaM;
}

export function alturaSistema(datos: DatosBombeo, cotaAguaM: number, caudalLs: number): number {
  const imp = perdidasTramo(datos.impulsion, caudalLs, datos.metodo, datos.temperaturaC).totalM;
  const suc =
    datos.tipo === "aspiracion" && datos.succion
      ? perdidasTramo(datos.succion, caudalLs, datos.metodo, datos.temperaturaC).totalM
      : 0;
  return alturaEstatica(datos, cotaAguaM) + imp + suc;
}

export function npshDisponible(datos: DatosBombeo, cotaAguaM: number, caudalLs: number) {
  const gamma = (densidadAgua(datos.temperaturaC) * G) / 1000; // kN/m³
  const patmM = presionAtmosfericaKPa(datos.altitudMsnm) / gamma;
  const pvM = presionVaporKPa(datos.temperaturaC) / gamma;
  const alturaAspiracionM = datos.cotaEjeBombaM - cotaAguaM;
  const hfSuccionM = datos.succion
    ? perdidasTramo(datos.succion, caudalLs, datos.metodo, datos.temperaturaC).totalM
    : 0;
  return { patmM, pvM, alturaAspiracionM, hfSuccionM, npshdM: patmM - pvM - alturaAspiracionM - hfSuccionM };
}

// ── Resultado ──────────────────────────────────────────────────────────────

export type NivelPozo = "minimo" | "maximo";

export interface ResultadoNivel {
  nivel: NivelPozo;
  cotaAguaM: number;
  alturaEstaticaM: number;
  /** Altura manométrica total con el caudal de diseño. */
  diseno: {
    caudalLs: number;
    impulsion: PerdidasTramo;
    succion: PerdidasTramo | null;
    alturaTotalM: number;
  };
  /** null si la curva de la bomba no corta la del sistema dentro de su rango. */
  operacion: {
    caudalLs: number;
    alturaM: number;
    rendimientoPct: number | null;
    potenciaHidraulicaKw: number;
    potenciaEjeKw: number | null;
    enRango: boolean;
  } | null;
  motivoSinOperacion: string | null;
  npsh: (ReturnType<typeof npshDisponible> & { npshrM: number | null; cumple: boolean | null }) | null;
  sumergencia: { disponibleM: number; requeridaM: number; cumple: boolean } | null;
}

export interface ResultadoBombeo {
  ajusteH: Polinomio;
  ajusteRendimiento: Polinomio | null;
  ajusteNpshr: Polinomio | null;
  caudalMinCurvaLs: number;
  caudalMaxCurvaLs: number;
  caudalBepLs: number | null;
  rendimientoBepPct: number | null;
  rangoRecomendadoLs: [number, number];
  rangoSegun: "bep" | "curva";
  niveles: Record<NivelPozo, ResultadoNivel>;
  avisos: string[];
}

function buscarInterseccion(f: (q: number) => number, a: number, b: number): number | null {
  const N = 200;
  let x0 = a;
  let f0 = f(x0);
  if (f0 === 0) return x0;
  for (let i = 1; i <= N; i++) {
    const x1 = a + ((b - a) * i) / N;
    const f1 = f(x1);
    if (f0 * f1 <= 0) {
      let lo = x0;
      let hi = x1;
      let flo = f0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      return (lo + hi) / 2;
    }
    x0 = x1;
    f0 = f1;
  }
  return null;
}

export function calcularBombeo(datos: DatosBombeo): ResultadoBombeo {
  const puntos = [...datos.curvaBomba].sort((p, q) => p.caudalLs - q.caudalLs);
  const qs = puntos.map((p) => p.caudalLs);
  const ajusteH = ajustarPolinomio(qs, puntos.map((p) => p.alturaM), datos.gradoAjuste);

  const conEta = puntos.filter((p) => p.rendimientoPct !== null);
  const ajusteRendimiento =
    conEta.length >= datos.gradoAjuste + 1
      ? ajustarPolinomio(conEta.map((p) => p.caudalLs), conEta.map((p) => p.rendimientoPct as number), datos.gradoAjuste)
      : null;
  const conNpsh = puntos.filter((p) => p.npshrM !== null);
  const ajusteNpshr =
    conNpsh.length >= 2
      ? ajustarPolinomio(conNpsh.map((p) => p.caudalLs), conNpsh.map((p) => p.npshrM as number), Math.min(2, conNpsh.length - 1))
      : null;

  const qMin = qs[0];
  const qMax = qs[qs.length - 1];
  const avisos: string[] = [];

  let caudalBepLs: number | null = null;
  let rendimientoBepPct: number | null = null;
  if (ajusteRendimiento) {
    // Máximo del rendimiento ajustado, muestreado sobre el rango de la curva.
    for (let i = 0; i <= 400; i++) {
      const q = qMin + ((qMax - qMin) * i) / 400;
      const eta = evaluarPolinomio(ajusteRendimiento.coef, q);
      if (rendimientoBepPct === null || eta > rendimientoBepPct) {
        rendimientoBepPct = eta;
        caudalBepLs = q;
      }
    }
  }
  const rangoRecomendadoLs: [number, number] =
    caudalBepLs !== null ? [0.7 * caudalBepLs, 1.2 * caudalBepLs] : [qMin, qMax];

  const hBomba = (q: number) => evaluarPolinomio(ajusteH.coef, q);
  const rendimiento = (q: number) => {
    if (!ajusteRendimiento) return null;
    const eta = evaluarPolinomio(ajusteRendimiento.coef, q);
    return Math.min(100, Math.max(0, eta));
  };
  const npshr = (q: number) =>
    ajusteNpshr ? Math.max(0, evaluarPolinomio(ajusteNpshr.coef, q)) : datos.npshrManualM;
  const rho = densidadAgua(datos.temperaturaC);

  const calcularNivel = (nivel: NivelPozo): ResultadoNivel => {
    const cotaAguaM = nivel === "minimo" ? datos.cotaNivelMinimoM : datos.cotaNivelMaximoM;
    const hEst = alturaEstatica(datos, cotaAguaM);
    const imp = perdidasTramo(datos.impulsion, datos.caudalDisenoLs, datos.metodo, datos.temperaturaC);
    const suc =
      datos.tipo === "aspiracion" && datos.succion
        ? perdidasTramo(datos.succion, datos.caudalDisenoLs, datos.metodo, datos.temperaturaC)
        : null;

    const f = (q: number) => hBomba(q) - alturaSistema(datos, cotaAguaM, q);
    const qOp = buscarInterseccion(f, qMin, qMax);
    let motivoSinOperacion: string | null = null;
    let operacion: ResultadoNivel["operacion"] = null;
    if (qOp === null) {
      motivoSinOperacion =
        f(qMax) > 0
          ? "La bomba da más altura que la que pide el sistema en todo el rango cargado: el punto de operación queda a la derecha de la curva (caudal mayor al último punto). Cargá más puntos o elegí otra bomba."
          : "La bomba no llega a la altura que pide el sistema en el rango cargado: no hay punto de operación. Elegí una bomba de más altura.";
    } else {
      const hOp = hBomba(qOp);
      const eta = rendimiento(qOp);
      const pHid = (rho * G * (qOp / 1000) * hOp) / 1000;
      operacion = {
        caudalLs: qOp,
        alturaM: hOp,
        rendimientoPct: eta,
        potenciaHidraulicaKw: pHid,
        potenciaEjeKw: eta && eta > 0 ? pHid / (eta / 100) : null,
        enRango: qOp >= rangoRecomendadoLs[0] && qOp <= rangoRecomendadoLs[1],
      };
    }

    const qNpsh = operacion?.caudalLs ?? datos.caudalDisenoLs;
    let npsh: ResultadoNivel["npsh"] = null;
    let sumergencia: ResultadoNivel["sumergencia"] = null;
    if (datos.tipo === "aspiracion") {
      const d = npshDisponible(datos, cotaAguaM, qNpsh);
      const req = npshr(qNpsh);
      npsh = { ...d, npshrM: req, cumple: req === null ? null : d.npshdM >= req + datos.margenNpshM };
    } else {
      const disponibleM = cotaAguaM - datos.cotaAdmisionM;
      sumergencia = {
        disponibleM,
        requeridaM: datos.sumergenciaMinimaM,
        cumple: disponibleM >= datos.sumergenciaMinimaM,
      };
    }

    return {
      nivel,
      cotaAguaM,
      alturaEstaticaM: hEst,
      diseno: {
        caudalLs: datos.caudalDisenoLs,
        impulsion: imp,
        succion: suc,
        alturaTotalM: hEst + imp.totalM + (suc?.totalM ?? 0),
      },
      operacion,
      motivoSinOperacion,
      npsh,
      sumergencia,
    };
  };

  const niveles = { minimo: calcularNivel("minimo"), maximo: calcularNivel("maximo") };

  for (const n of [niveles.minimo, niveles.maximo]) {
    const etiqueta = n.nivel === "minimo" ? "nivel mínimo" : "nivel máximo";
    if (n.operacion && !n.operacion.enRango) {
      avisos.push(
        `Con ${etiqueta} el punto de operación (Q = ${fmt(n.operacion.caudalLs, 1)} L/s) queda fuera del rango recomendado de la bomba (${fmt(rangoRecomendadoLs[0], 1)} a ${fmt(rangoRecomendadoLs[1], 1)} L/s).`
      );
    }
    if (n.npsh && n.npsh.cumple === false) {
      avisos.push(`Con ${etiqueta} el NPSH disponible no alcanza al requerido más el margen: riesgo de cavitación.`);
    }
    if (n.sumergencia && !n.sumergencia.cumple) {
      avisos.push(`Con ${etiqueta} la sumergencia sobre la admisión es menor que la mínima del fabricante.`);
    }
  }
  if (datos.tipo === "aspiracion" && !ajusteNpshr && datos.npshrManualM === null) {
    avisos.push("Sin NPSHr (ni en la curva ni cargado a mano) no se puede verificar la cavitación.");
  }
  if (datos.tipo === "aspiracion" && niveles.minimo.npsh && niveles.minimo.npsh.alturaAspiracionM > 7) {
    avisos.push("La altura de aspiración supera los 7 m: en la práctica una bomba de superficie difícilmente aspire más.");
  }
  for (let i = 1; i < puntos.length; i++) {
    if (puntos[i].alturaM > puntos[i - 1].alturaM + 1e-9) {
      avisos.push("La curva Q-H cargada no es decreciente en todo el rango; revisá los puntos (una curva inestable puede dar dos puntos de operación).");
      break;
    }
  }
  if (ajusteH.r2 < 0.98) {
    avisos.push(`El ajuste de la curva Q-H es pobre (R² = ${fmt(ajusteH.r2, 3)}). Revisá los puntos o probá con otro grado.`);
  }

  return {
    ajusteH,
    ajusteRendimiento,
    ajusteNpshr,
    caudalMinCurvaLs: qMin,
    caudalMaxCurvaLs: qMax,
    caudalBepLs,
    rendimientoBepPct,
    rangoRecomendadoLs,
    rangoSegun: caudalBepLs !== null ? "bep" : "curva",
    niveles,
    avisos,
  };
}

// ── Curva de la bomba: columnas y validación ───────────────────────────────

export const COLUMNAS_CURVA_BOMBA: readonly EspecColumna[] = [
  { clave: "caudalLs", nombre: "caudal_ls", alias: ["caudal", "q"], obligatoria: true, tipo: "numero" },
  { clave: "alturaM", nombre: "altura_m", alias: ["altura", "h", "hm", "tdh", "carga"], obligatoria: true, tipo: "numero" },
  {
    clave: "rendimientoPct",
    nombre: "rendimiento_pct",
    alias: ["rendimiento", "eficiencia", "eta", "n"],
    obligatoria: false,
    tipo: "numero",
  },
  { clave: "npshrM", nombre: "npshr_m", alias: ["npshr", "npsh", "npsh_r", "npsh_requerido"], obligatoria: false, tipo: "numero" },
];

export function validarCurvaBomba(
  filas: readonly string[][],
  grado: number,
  numeroFila: (i: number) => number = (i) => i + 1
): { puntos: PuntoBomba[] | null; errores: string[] } {
  const errores: string[] = [];
  const puntos: PuntoBomba[] = [];
  filas.forEach((fila, i) => {
    const n = numeroFila(i);
    const leer = (j: number, nombre: string, obligatorio: boolean) => {
      const texto = fila[j] ?? "";
      const v = numeroDeCelda(texto);
      if (v === null) {
        if (obligatorio) errores.push(`Fila ${n}: falta ${nombre}.`);
        return null;
      }
      if (Number.isNaN(v)) {
        errores.push(`Fila ${n}: ${nombre} «${texto}» no es un número.`);
        return null;
      }
      if (v < 0) errores.push(`Fila ${n}: ${nombre} negativo (${texto}).`);
      return v;
    };
    const q = leer(0, "el caudal", true);
    const h = leer(1, "la altura", true);
    const eta = leer(2, "el rendimiento", false);
    const npsh = leer(3, "el NPSHr", false);
    if (eta !== null && eta > 100) errores.push(`Fila ${n}: el rendimiento se carga en %, entre 0 y 100.`);
    puntos.push({ caudalLs: q ?? NaN, alturaM: h ?? NaN, rendimientoPct: eta, npshrM: npsh });
  });

  if (puntos.length < grado + 1) {
    errores.push(`Para un ajuste de grado ${grado} hacen falta al menos ${grado + 1} puntos Q-H.`);
  }
  const ordenados = [...puntos].sort((a, b) => a.caudalLs - b.caudalLs);
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].caudalLs === ordenados[i - 1].caudalLs) {
      errores.push(`El caudal ${ordenados[i].caudalLs} L/s está repetido en la curva.`);
      break;
    }
  }
  const conEta = puntos.filter((p) => p.rendimientoPct !== null).length;
  if (conEta > 0 && conEta < grado + 1) {
    errores.push(`Hay rendimiento en ${conEta} puntos: para ajustar Q-η hacen falta al menos ${grado + 1}, o dejá la columna vacía.`);
  }
  const conNpsh = puntos.filter((p) => p.npshrM !== null).length;
  if (conNpsh === 1) {
    errores.push("Hay NPSHr en un solo punto: cargá al menos dos o dejá la columna vacía y usá el valor fijo.");
  }
  return { puntos: errores.length === 0 ? puntos : null, errores };
}

/** Curva de catálogo ilustrativa (bomba centrífuga de unos 20 L/s a 45 m), no de un modelo real. */
export const CURVA_BOMBA_EJEMPLO: string[][] = [
  ["0", "58", "0", "1,6"],
  ["5", "57", "38", "1,7"],
  ["10", "54,5", "58", "2"],
  ["15", "50,5", "70", "2,4"],
  ["20", "45", "75", "3"],
  ["25", "38", "73", "3,8"],
  ["30", "29", "64", "4,9"],
];
