import { calcularPerdidaCarga, type MetodoPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";
import type { EspecColumna } from "@/lib/calculadoras/tablas";
import { numeroDeCelda } from "@/lib/calculadoras/tablas";
import { fmt } from "@/lib/calculadoras/formato";

/**
 * Bombeo: altura manométrica, elección de la bomba y potencia.
 *
 * Altura manométrica total para un nivel del agua en el pozo:
 *   H(Q) = (z_descarga − z_agua) + p_descarga/γ + Σ tramos [hf + ΣK·V²/2g + h_fija·(Q/Qd)²]
 * con la impulsión armada por tramos en serie (manifold, impulsión, etc.), cada
 * uno con su diámetro, material, accesorios y pérdidas fijas (caudalímetro,
 * filtro), y una succión si la bomba es de aspiración. Un tramo puede llevar
 * el caudal de una bomba (colector de cada bomba) o el total.
 *
 * Con n bombas iguales en paralelo, la curva conjunta es H_n(Q) = H_1(Q/n).
 *
 * Diseño: H con nivel mínimo, medio y máximo; altura ajustada = H_máx × coef.
 * de seguridad; potencia hidráulica = ρ·g·Q_bomba·H_máx; al eje = P_hid/η_bomba;
 * del motor = P_eje/η_motor; total = n en operación × P_motor.
 *
 * Con curva de la bomba (opcional): ajuste polinómico Q-H (y Q-η, Q-NPSHr),
 * punto de operación H_n(Q) = H_sistema(Q) por bisección en el rango cargado,
 * y rango recomendado 70–120 % de Q_BEP (ANSI/HI 9.6.3).
 *
 * NPSH disponible (aspiración): NPSHd = p_atm/γ − p_v/γ − h_s − hf_succión.
 * Sumergencia (sumergible): S = z_agua − z_admisión ≥ S_mín del fabricante.
 */

export type TipoBomba = "aspiracion" | "sumergible";

export const G_ESTANDAR = 9.81;

export interface Accesorio {
  id: string;
  nombre: string;
  /** Coeficiente K de pérdida localizada, valor de catálogo. */
  k: number;
}

/** Accesorios habituales con su K (tablas de Azevedo Netto / Sotelo; editables en la calculadora). */
export const ACCESORIOS: readonly Accesorio[] = [
  { id: "entrada", nombre: "Entrada", k: 0.5 },
  { id: "reduccion", nombre: "Ampliación / reducción", k: 0.3 },
  { id: "te-directa", nombre: "Te, paso directo", k: 0.6 },
  { id: "te-lateral", nombre: "Te, salida lateral", k: 1.8 },
  { id: "codo-45", nombre: "Codo 45°", k: 0.4 },
  { id: "codo-90", nombre: "Codo 90°", k: 0.9 },
  { id: "valvula", nombre: "Válvula / llave abierta", k: 0.2 },
  { id: "retencion", nombre: "Válvula de retención", k: 2.5 },
  { id: "pie", nombre: "Válvula de pie con colador", k: 2.5 },
  { id: "salida", nombre: "Salida", k: 1 },
];

export interface TramoTuberia {
  nombre: string;
  longitudM: number;
  /** Diámetro interior. */
  diametroMm: number;
  rugosidadMm: number;
  hazenC: number;
  sumaK: number;
  /** Pérdida fija con el caudal de diseño (caudalímetro, filtro…); varía con (Q/Qd)². */
  perdidaFijaM: number;
  /** El tramo lleva el caudal de una sola bomba (colector propio de cada bomba). */
  porBomba: boolean;
}

export interface OpcionesHidraulicas {
  metodo: MetodoPerdidaCarga;
  temperaturaC: number;
  g: number;
  hazenCoef: number;
  hazenExp: number;
  /** kg/m³ */
  densidad: number;
}

export interface PuntoBomba {
  caudalLs: number;
  alturaM: number;
  rendimientoPct: number | null;
  npshrM: number | null;
}

export interface DatosBombeo {
  tipo: TipoBomba;
  hid: OpcionesHidraulicas;
  /** Caudal total de diseño de la estación. */
  caudalDisenoLs: number;
  bombasOperacion: number;
  bombasInstaladas: number;
  cotaNivelMinimoM: number;
  cotaNivelMaximoM: number;
  cotaDescargaM: number;
  /** Presión que se quiere tener en el punto de descarga, en m de columna de agua. */
  presionDescargaM: number;
  impulsion: TramoTuberia[];
  /** Sólo con bomba de aspiración: la succión de cada bomba. */
  succion: TramoTuberia | null;
  coefSeguridad: number;
  cotaEjeBombaM: number;
  altitudMsnm: number;
  npshrManualM: number | null;
  margenNpshM: number;
  cotaAdmisionM: number;
  sumergenciaMinimaM: number;
  /** Curva de una bomba; vacía si todavía no se eligió. */
  curvaBomba: PuntoBomba[];
  gradoAjuste: 2 | 3;
  /** Rendimiento de la bomba cuando la curva no trae η (o no hay curva). */
  rendimientoBombaPct: number;
  /** Rendimiento del motor (o mecánico de la transmisión). */
  rendimientoMotorPct: number;
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

/** Potencias normalizadas de motores eléctricos (IEC 60072), en kW. */
export const MOTORES_IEC_KW = [
  0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160,
  200, 250, 315, 355, 400, 450, 500,
];

export function motorComercialKw(potenciaKw: number): number | null {
  return MOTORES_IEC_KW.find((p) => p >= potenciaKw - 1e-9) ?? null;
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
  nombre: string;
  caudalLs: number;
  velocidadMs: number;
  /** Pendiente de fricción, m/km. */
  pendienteMKm: number;
  friccionM: number;
  localizadaM: number;
  fijaM: number;
  totalM: number;
  factorFriccion: number | null;
  reynolds: number | null;
}

/**
 * Pérdidas de un tramo con el caudal total `caudalTotalLs` de la estación; si
 * el tramo es de una bomba, lleva Q/n.
 */
export function perdidasTramo(
  tramo: TramoTuberia,
  caudalTotalLs: number,
  datos: Pick<DatosBombeo, "hid" | "bombasOperacion" | "caudalDisenoLs">
): PerdidasTramo {
  const n = Math.max(1, datos.bombasOperacion);
  const caudalLs = tramo.porBomba ? caudalTotalLs / n : caudalTotalLs;
  const fijaM = tramo.perdidaFijaM * (caudalTotalLs / datos.caudalDisenoLs) ** 2;
  if (caudalLs <= 0) {
    return {
      nombre: tramo.nombre,
      caudalLs: 0,
      velocidadMs: 0,
      pendienteMKm: 0,
      friccionM: 0,
      localizadaM: 0,
      fijaM: 0,
      totalM: 0,
      factorFriccion: null,
      reynolds: null,
    };
  }
  const { hid } = datos;
  const r = calcularPerdidaCarga({
    metodo: hid.metodo,
    caudalLs,
    temperaturaC: hid.temperaturaC,
    g: hid.g,
    hazenCoef: hid.hazenCoef,
    hazenExp: hid.hazenExp,
    longitudM: tramo.longitudM,
    diametroMm: tramo.diametroMm,
    rugosidadMm: tramo.rugosidadMm,
    hazenC: tramo.hazenC,
    sumaK: tramo.sumaK,
  });
  return {
    nombre: tramo.nombre,
    caudalLs,
    velocidadMs: r.velocidadMs,
    pendienteMKm: r.pendienteHidraulica * 1000,
    friccionM: r.perdidaFriccionM,
    localizadaM: r.perdidaLocalizadaM,
    fijaM,
    totalM: r.perdidaTotalM + fijaM,
    factorFriccion: r.factorFriccion,
    reynolds: r.reynolds,
  };
}

export function alturaEstatica(datos: DatosBombeo, cotaAguaM: number): number {
  return datos.cotaDescargaM - cotaAguaM + datos.presionDescargaM;
}

export function perdidasSistema(datos: DatosBombeo, caudalTotalLs: number) {
  const impulsion = datos.impulsion.map((t) => perdidasTramo(t, caudalTotalLs, datos));
  const succion =
    datos.tipo === "aspiracion" && datos.succion
      ? perdidasTramo({ ...datos.succion, porBomba: true }, caudalTotalLs, datos)
      : null;
  const totalM = impulsion.reduce((s, t) => s + t.totalM, 0) + (succion?.totalM ?? 0);
  return { impulsion, succion, totalM };
}

export function alturaSistema(datos: DatosBombeo, cotaAguaM: number, caudalTotalLs: number): number {
  return alturaEstatica(datos, cotaAguaM) + perdidasSistema(datos, caudalTotalLs).totalM;
}

/** NPSH disponible con el caudal de una bomba `caudalBombaLs`. */
export function npshDisponible(datos: DatosBombeo, cotaAguaM: number, caudalBombaLs: number) {
  const gamma = (datos.hid.densidad * datos.hid.g) / 1000; // kN/m³
  const patmM = presionAtmosfericaKPa(datos.altitudMsnm) / gamma;
  const pvM = presionVaporKPa(datos.hid.temperaturaC) / gamma;
  const alturaAspiracionM = datos.cotaEjeBombaM - cotaAguaM;
  const n = Math.max(1, datos.bombasOperacion);
  const hfSuccionM = datos.succion
    ? perdidasTramo({ ...datos.succion, porBomba: true }, caudalBombaLs * n, datos).totalM
    : 0;
  return { patmM, pvM, alturaAspiracionM, hfSuccionM, npshdM: patmM - pvM - alturaAspiracionM - hfSuccionM };
}

// ── Resultado ──────────────────────────────────────────────────────────────

export type NivelPozo = "minimo" | "medio" | "maximo";

export interface AlturaNivel {
  nivel: NivelPozo;
  cotaAguaM: number;
  alturaEstaticaM: number;
  perdidas: ReturnType<typeof perdidasSistema>;
  alturaTotalM: number;
}

export interface OperacionNivel {
  nivel: "minimo" | "maximo";
  cotaAguaM: number;
  /** null si la curva de la bomba no corta la del sistema dentro de su rango. */
  operacion: {
    caudalTotalLs: number;
    caudalBombaLs: number;
    alturaM: number;
    rendimientoPct: number;
    potenciaHidraulicaKw: number;
    potenciaEjeKw: number;
    potenciaMotorKw: number;
    enRango: boolean;
  } | null;
  motivoSinOperacion: string | null;
  npsh: (ReturnType<typeof npshDisponible> & { npshrM: number | null; cumple: boolean | null; caudalBombaLs: number }) | null;
  sumergencia: { disponibleM: number; requeridaM: number; cumple: boolean } | null;
}

export interface ResultadoCurva {
  ajusteH: Polinomio;
  ajusteRendimiento: Polinomio | null;
  ajusteNpshr: Polinomio | null;
  caudalMinCurvaLs: number;
  caudalMaxCurvaLs: number;
  caudalBepLs: number | null;
  rendimientoBepPct: number | null;
  /** Rango recomendado por bomba. */
  rangoRecomendadoLs: [number, number];
  rangoSegun: "bep" | "curva";
  /** Altura que da la bomba con el caudal de diseño por bomba. */
  alturaBombaDisenoM: number;
}

export interface ResultadoBombeo {
  caudalBombaLs: number;
  bombasReserva: number;
  alturas: Record<NivelPozo, AlturaNivel>;
  alturaAjustadaM: number;
  diseno: {
    rendimientoPct: number;
    rendimientoDeCurva: boolean;
    potenciaHidraulicaKw: number;
    potenciaEjeKw: number;
    potenciaMotorKw: number;
    potenciaTotalKw: number;
    motorComercialKw: number | null;
  };
  curva: ResultadoCurva | null;
  niveles: Record<"minimo" | "maximo", OperacionNivel>;
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

/** Curva Q-H por bomba ajustada; null si no hay puntos suficientes. */
function ajustarCurva(datos: DatosBombeo): ResultadoCurva | null {
  const puntos = [...datos.curvaBomba].sort((p, q) => p.caudalLs - q.caudalLs);
  if (puntos.length < datos.gradoAjuste + 1) return null;
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

  let caudalBepLs: number | null = null;
  let rendimientoBepPct: number | null = null;
  if (ajusteRendimiento) {
    for (let i = 0; i <= 400; i++) {
      const q = qMin + ((qMax - qMin) * i) / 400;
      const eta = evaluarPolinomio(ajusteRendimiento.coef, q);
      if (rendimientoBepPct === null || eta > rendimientoBepPct) {
        rendimientoBepPct = eta;
        caudalBepLs = q;
      }
    }
  }
  return {
    ajusteH,
    ajusteRendimiento,
    ajusteNpshr,
    caudalMinCurvaLs: qMin,
    caudalMaxCurvaLs: qMax,
    caudalBepLs,
    rendimientoBepPct,
    rangoRecomendadoLs: caudalBepLs !== null ? [0.7 * caudalBepLs, 1.2 * caudalBepLs] : [qMin, qMax],
    rangoSegun: caudalBepLs !== null ? "bep" : "curva",
    alturaBombaDisenoM: evaluarPolinomio(ajusteH.coef, datos.caudalDisenoLs / Math.max(1, datos.bombasOperacion)),
  };
}

export function calcularBombeo(datos: DatosBombeo): ResultadoBombeo {
  const n = Math.max(1, datos.bombasOperacion);
  const { hid } = datos;
  const caudalBombaLs = datos.caudalDisenoLs / n;
  const avisos: string[] = [];

  const altura = (nivel: NivelPozo): AlturaNivel => {
    const cotaAguaM =
      nivel === "minimo"
        ? datos.cotaNivelMinimoM
        : nivel === "maximo"
          ? datos.cotaNivelMaximoM
          : (datos.cotaNivelMinimoM + datos.cotaNivelMaximoM) / 2;
    const perdidas = perdidasSistema(datos, datos.caudalDisenoLs);
    const alturaEstaticaM = alturaEstatica(datos, cotaAguaM);
    return { nivel, cotaAguaM, alturaEstaticaM, perdidas, alturaTotalM: alturaEstaticaM + perdidas.totalM };
  };
  // "minimo" es el nivel mínimo del agua, que da la altura MÁXIMA de bombeo.
  const alturas = { minimo: altura("minimo"), medio: altura("medio"), maximo: altura("maximo") };
  const hMax = alturas.minimo.alturaTotalM;

  const curva = ajustarCurva(datos);
  const hBomba = (qBomba: number) => (curva ? evaluarPolinomio(curva.ajusteH.coef, qBomba) : NaN);
  const etaCurva = (qBomba: number) =>
    curva?.ajusteRendimiento ? Math.min(100, Math.max(0, evaluarPolinomio(curva.ajusteRendimiento.coef, qBomba))) : null;
  const etaDe = (qBomba: number) => etaCurva(qBomba) ?? datos.rendimientoBombaPct;
  const potencias = (qBomba: number, h: number) => {
    const eta = etaDe(qBomba);
    const hidKw = (hid.densidad * hid.g * (qBomba / 1000) * h) / 1000;
    const eje = hidKw / (eta / 100);
    return { eta, hidKw, eje, motor: eje / (datos.rendimientoMotorPct / 100) };
  };

  const pd = potencias(caudalBombaLs, hMax);
  const diseno = {
    rendimientoPct: pd.eta,
    rendimientoDeCurva: etaCurva(caudalBombaLs) !== null,
    potenciaHidraulicaKw: pd.hidKw,
    potenciaEjeKw: pd.eje,
    potenciaMotorKw: pd.motor,
    potenciaTotalKw: pd.motor * n,
    motorComercialKw: motorComercialKw(pd.motor),
  };

  const npshr = (qBomba: number) =>
    curva?.ajusteNpshr ? Math.max(0, evaluarPolinomio(curva.ajusteNpshr.coef, qBomba)) : datos.npshrManualM;

  const operar = (nivel: "minimo" | "maximo"): OperacionNivel => {
    const cotaAguaM = nivel === "minimo" ? datos.cotaNivelMinimoM : datos.cotaNivelMaximoM;
    let operacion: OperacionNivel["operacion"] = null;
    let motivoSinOperacion: string | null = null;
    if (curva) {
      const f = (qTotal: number) => hBomba(qTotal / n) - alturaSistema(datos, cotaAguaM, qTotal);
      const qOp = buscarInterseccion(f, curva.caudalMinCurvaLs * n, curva.caudalMaxCurvaLs * n);
      if (qOp === null) {
        motivoSinOperacion =
          f(curva.caudalMaxCurvaLs * n) > 0
            ? "La bomba da más altura que la que pide el sistema en todo el rango cargado: el punto de operación queda a la derecha de la curva (caudal mayor al último punto). Cargá más puntos o elegí otra bomba."
            : "La bomba no llega a la altura que pide el sistema en el rango cargado: no hay punto de operación. Elegí una bomba de más altura o agregá bombas en operación.";
      } else {
        const qb = qOp / n;
        const h = hBomba(qb);
        const p = potencias(qb, h);
        operacion = {
          caudalTotalLs: qOp,
          caudalBombaLs: qb,
          alturaM: h,
          rendimientoPct: p.eta,
          potenciaHidraulicaKw: p.hidKw,
          potenciaEjeKw: p.eje,
          potenciaMotorKw: p.motor,
          enRango: qb >= curva.rangoRecomendadoLs[0] && qb <= curva.rangoRecomendadoLs[1],
        };
      }
    }
    const qNpsh = operacion?.caudalBombaLs ?? caudalBombaLs;
    let npsh: OperacionNivel["npsh"] = null;
    let sumergencia: OperacionNivel["sumergencia"] = null;
    if (datos.tipo === "aspiracion") {
      const d = npshDisponible(datos, cotaAguaM, qNpsh);
      const req = npshr(qNpsh);
      npsh = { ...d, npshrM: req, cumple: req === null ? null : d.npshdM >= req + datos.margenNpshM, caudalBombaLs: qNpsh };
    } else {
      const disponibleM = cotaAguaM - datos.cotaAdmisionM;
      sumergencia = { disponibleM, requeridaM: datos.sumergenciaMinimaM, cumple: disponibleM >= datos.sumergenciaMinimaM };
    }
    return { nivel, cotaAguaM, operacion, motivoSinOperacion, npsh, sumergencia };
  };
  const niveles = { minimo: operar("minimo"), maximo: operar("maximo") };

  // Avisos
  for (const t of alturas.minimo.perdidas.impulsion) {
    if (t.velocidadMs > 0 && (t.velocidadMs < 0.6 || t.velocidadMs > 2.5)) {
      avisos.push(
        `Velocidad de ${fmt(t.velocidadMs, 2)} m/s en «${t.nombre}», fuera del rango habitual de 0,6 a 2,5 m/s${t.velocidadMs < 0.6 ? " (riesgo de sedimentación con líquidos con sólidos)" : " (pérdidas y golpe de ariete altos)"}.`
      );
    }
  }
  for (const nv of [niveles.minimo, niveles.maximo]) {
    const etiqueta = nv.nivel === "minimo" ? "nivel mínimo" : "nivel máximo";
    if (nv.operacion && curva && !nv.operacion.enRango) {
      avisos.push(
        `Con ${etiqueta} cada bomba opera con Q = ${fmt(nv.operacion.caudalBombaLs, 1)} L/s, fuera del rango recomendado (${fmt(curva.rangoRecomendadoLs[0], 1)} a ${fmt(curva.rangoRecomendadoLs[1], 1)} L/s).`
      );
    }
    if (nv.npsh && nv.npsh.cumple === false) {
      avisos.push(`Con ${etiqueta} el NPSH disponible no alcanza al requerido más el margen: riesgo de cavitación.`);
    }
    if (nv.sumergencia && !nv.sumergencia.cumple) {
      avisos.push(`Con ${etiqueta} la sumergencia sobre la admisión es menor que la mínima.`);
    }
  }
  if (curva && curva.alturaBombaDisenoM < alturas.minimo.alturaTotalM * datos.coefSeguridad - 1e-9) {
    avisos.push(
      `Con el caudal de diseño por bomba la curva da ${fmt(curva.alturaBombaDisenoM, 2)} m, menos que la altura ajustada de ${fmt(alturas.minimo.alturaTotalM * datos.coefSeguridad, 2)} m.`
    );
  }
  if (datos.tipo === "aspiracion" && !curva?.ajusteNpshr && datos.npshrManualM === null) {
    avisos.push("Sin NPSHr (ni en la curva ni cargado a mano) no se puede verificar la cavitación.");
  }
  if (datos.tipo === "aspiracion" && niveles.minimo.npsh && niveles.minimo.npsh.alturaAspiracionM > 7) {
    avisos.push("La altura de aspiración supera los 7 m: en la práctica una bomba de superficie difícilmente aspire más.");
  }
  if (curva) {
    const pts = [...datos.curvaBomba].sort((p, q) => p.caudalLs - q.caudalLs);
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].alturaM > pts[i - 1].alturaM + 1e-9) {
        avisos.push("La curva Q-H cargada no es decreciente en todo el rango; revisá los puntos (una curva inestable puede dar dos puntos de operación).");
        break;
      }
    }
    if (curva.ajusteH.r2 < 0.98) {
      avisos.push(`El ajuste de la curva Q-H es pobre (R² = ${fmt(curva.ajusteH.r2, 3)}). Revisá los puntos o probá con otro grado.`);
    }
  }
  if (datos.bombasInstaladas < datos.bombasOperacion) {
    avisos.push("Hay más bombas en operación que instaladas.");
  } else if (datos.bombasInstaladas === datos.bombasOperacion) {
    avisos.push("No queda ninguna bomba de reserva: lo habitual es al menos una (n + 1).");
  }

  return {
    caudalBombaLs,
    bombasReserva: Math.max(0, datos.bombasInstaladas - datos.bombasOperacion),
    alturas,
    alturaAjustadaM: hMax * datos.coefSeguridad,
    diseno,
    curva,
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

/** Valida la curva; una tabla vacía es válida y significa "sin curva todavía". */
export function validarCurvaBomba(
  filas: readonly string[][],
  grado: number,
  numeroFila: (i: number) => number = (i) => i + 1
): { puntos: PuntoBomba[] | null; errores: string[] } {
  const errores: string[] = [];
  const puntos: PuntoBomba[] = [];
  const conDatos = filas.filter((f) => f.some((c) => (c ?? "").trim() !== ""));
  if (conDatos.length === 0) return { puntos: [], errores: [] };
  filas.forEach((fila, i) => {
    if (!fila.some((c) => (c ?? "").trim() !== "")) return;
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
