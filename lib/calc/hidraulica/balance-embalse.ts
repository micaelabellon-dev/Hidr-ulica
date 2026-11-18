import { diasDelMes, fechaDeCelda, numeroDeCelda, type EspecColumna } from "@/lib/calculadoras/tablas";

/**
 * Balance hídrico de un embalse, paso a paso, con reglas de operación:
 *
 *   W = V(t) + Aporte + Lluvia − Evaporación − Infiltración     agua disponible
 *   Qamb liberado = mín(Qamb objetivo; W)                       1.º el caudal ambiental
 *   Suministro    = máx(0; mín(Demanda; W − Qamb lib − Vmín))   2.º la demanda, sin bajar del volumen muerto
 *   Vertido       = máx(0; W − Qamb lib − Suministro − Vmáx)    3.º lo que no entra, vierte
 *   V(t+1)        = W − Qamb lib − Suministro − Vertido
 *   Déficit       = Demanda − Suministro
 *
 * Lluvia = P·A y Evaporación = mín(E·k·A; lo que hay), con A el área del
 * espejo y k el coeficiente de tanque. A se toma, a elección, en el volumen
 * del inicio del paso (como una planilla mes a mes) o en el volumen medio del
 * paso, (V(t) + V(t+1))/2, resuelto por punto fijo porque V(t+1) depende de A.
 *
 * Caudal ambiental: constante, o por percentil de permanencia (Q60, Q70, Q80,
 * Q90) con la regionalización de Dinagua: q(FF%) = q medio del cuatrimestre ×
 * factor de la subregión, por el área de la cuenca. El objetivo es el Qamb
 * completo, o mín(aporte; Qamb) para no liberar más de lo que entra.
 *
 * Unidades internas: caudales en m³/s, láminas en mm, áreas en ha, volúmenes
 * en hm³. La serie puede traer caudales en m³/s o como volumen del paso.
 *   Q·Δt [m³] → /10⁶ → hm³;   lámina·A [mm·ha] = 10 m³ → ×10⁻⁵ → hm³
 */

export type PasoTiempo = "mensual" | "diario";
export type AreaEnPaso = "inicio" | "medio";
/** "volumen": la serie trae m³ en el paso (m³/mes o m³/día) en vez de m³/s. */
export type UnidadCaudalSerie = "m3s" | "volumen";
/** "minimo-aporte": se libera mín(aporte; Qamb). "completo": se libera el Qamb aunque entre menos. */
export type ModoLiberacion = "minimo-aporte" | "completo";

export interface PuntoCurva {
  cotaM: number;
  areaHa: number;
  volumenHm3: number;
}

export interface RegistroSerie {
  /** ISO yyyy-mm-dd (día 01 en paso mensual). */
  fecha: string;
  /** m³/s, o m³ en el paso según `unidadCaudal`. */
  aporte: number;
  /** Lámina precipitada en el paso, en mm (del mes o del día). */
  precipitacionMm: number;
  /** Lámina evaporada en el paso (tanque), en mm. */
  evaporacionMm: number;
  /** Demanda a suministrar: m³/s, o m³ en el paso según `unidadCaudal`. */
  extraccion: number;
  /** ETP del paso en mm, para el modelo de Témez (NaN o ausente si no se cargó). */
  etpMm?: number;
}

export interface DatosBalance {
  paso: PasoTiempo;
  serie: RegistroSerie[];
  unidadCaudal: UnidadCaudalSerie;
  curva: PuntoCurva[];
  /** Caudal ambiental exigido por mes del año (índice 0 = enero), en m³/s. */
  qambPorMesM3s: readonly number[];
  modoLiberacion: ModoLiberacion;
  infiltracionM3s: number;
  /** Coeficiente que pasa la evaporación de tanque a evaporación del lago. */
  coefEvaporacion: number;
  areaEnPaso: AreaEnPaso;
  volumenInicialHm3: number;
  volumenMinimoHm3: number;
  volumenMaximoHm3: number;
}

export interface PasoBalance {
  indice: number;
  fecha: string;
  duracionS: number;
  volumenInicialHm3: number;
  cotaInicialM: number;
  areaHa: number;
  /** Volumen con el que se interpoló el área (inicial o medio). */
  volumenAreaHm3: number;
  aporteHm3: number;
  precipitacionHm3: number;
  evaporacionHm3: number;
  infiltracionHm3: number;
  disponibleHm3: number;
  qambExigidoHm3: number;
  qambObjetivoHm3: number;
  qambLiberadoHm3: number;
  demandaHm3: number;
  suministroHm3: number;
  vertidoHm3: number;
  deficitHm3: number;
  salidaAguasAbajoHm3: number;
  volumenFinalHm3: number;
  cotaFinalM: number;
  cumpleDemanda: boolean;
  cumpleQamb: boolean;
  iteraciones: number;
}

export interface ResultadoBalance {
  pasos: PasoBalance[];
  volumenMinimo: { valorHm3: number; fecha: string };
  volumenMaximo: { valorHm3: number; fecha: string };
  cotaMinimaM: number;
  cotaMaximaM: number;
  pasosConDeficit: number;
  pasosConVertido: number;
  rachaMaximaFalla: number;
  deficitMaximoHm3: number;
  deficitTotalHm3: number;
  vertidoTotalHm3: number;
  /** Fracción de pasos con la demanda 100 % cubierta. */
  garantiaTemporal: number;
  /** Volumen suministrado / volumen demandado. */
  garantiaVolumetrica: number;
  /** Fracción de pasos con salida aguas abajo (Qamb liberado + vertido) ≥ Qamb exigido. */
  cumplimientoQamb: number;
  totales: Record<
    "aporte" | "precipitacion" | "evaporacion" | "infiltracion" | "qambLiberado" | "demanda" | "suministro" | "vertido",
    number
  >;
  /** V0 + entradas − salidas − V final: tiene que dar 0. */
  cierreHm3: number;
}

/** Conversión m³/s durante Δt segundos a hm³. */
export const caudalAVolumenHm3 = (caudalM3s: number, duracionS: number) => (caudalM3s * duracionS) / 1e6;
/** Lámina de mm sobre un área en ha, a hm³ (1 mm·ha = 10 m³). */
export const laminaAVolumenHm3 = (laminaMm: number, areaHa: number) => laminaMm * areaHa * 1e-5;

export function duracionPasoS(fechaIso: string, paso: PasoTiempo): number {
  if (paso === "diario") return 86_400;
  const [anio, mes] = fechaIso.split("-").map(Number);
  return diasDelMes(anio, mes) * 86_400;
}

/** Interpolación lineal en la curva, por la columna `de`, recortada a sus extremos. */
export function interpolarCurva(
  curva: readonly PuntoCurva[],
  de: keyof PuntoCurva,
  valor: number,
  a: keyof PuntoCurva
): number {
  if (valor <= curva[0][de]) return curva[0][a];
  const ultimo = curva[curva.length - 1];
  if (valor >= ultimo[de]) return ultimo[a];
  for (let i = 0; i < curva.length - 1; i++) {
    const p0 = curva[i];
    const p1 = curva[i + 1];
    if (valor >= p0[de] && valor <= p1[de]) {
      const f = p1[de] === p0[de] ? 0 : (valor - p0[de]) / (p1[de] - p0[de]);
      return p0[a] + f * (p1[a] - p0[a]);
    }
  }
  return ultimo[a];
}

export const cotaDeVolumen = (curva: readonly PuntoCurva[], v: number) => interpolarCurva(curva, "volumenHm3", v, "cotaM");
export const areaDeVolumen = (curva: readonly PuntoCurva[], v: number) => interpolarCurva(curva, "volumenHm3", v, "areaHa");
export const volumenDeCota = (curva: readonly PuntoCurva[], z: number) => interpolarCurva(curva, "cotaM", z, "volumenHm3");

// ── Caudal ambiental por percentil ─────────────────────────────────────────

export const CUATRIMESTRES = ["ABR-JUL", "AGO-NOV", "DIC-MAR"] as const;
export const PERCENTILES = ["Q60", "Q70", "Q80", "Q90"] as const;
export type Percentil = (typeof PERCENTILES)[number];

/** Cuatrimestre de cada mes (0 = enero): DIC-MAR = 2, ABR-JUL = 0, AGO-NOV = 1. */
export function cuatrimestreDeMes(mes0: number): 0 | 1 | 2 {
  const m = mes0 + 1;
  if (m >= 12 || m <= 3) return 2;
  return m <= 7 ? 0 : 1;
}

export interface DatosQambPercentil {
  areaCuencaKm2: number;
  /** q medio de cada cuatrimestre (ABR-JUL, AGO-NOV, DIC-MAR), en L/s/km². */
  qMedioLsKm2: readonly [number, number, number];
  /** Factor q(FF%)/q por percentil (Q60…Q90) y cuatrimestre. */
  factores: Readonly<Record<Percentil, readonly [number, number, number]>>;
  percentil: Percentil;
  /** Usar el valor de DIC-MAR (estiaje) en los doce meses. */
  dicMarTodoElAnio: boolean;
}

/** Qamb exigido de cada mes del año, en m³/s: q medio × factor × área / 1000. */
export function qambPorPercentil(d: DatosQambPercentil): number[] {
  return Array.from({ length: 12 }, (_, mes0) => {
    const c = d.dicMarTodoElAnio ? 2 : cuatrimestreDeMes(mes0);
    return (d.qMedioLsKm2[c] * d.factores[d.percentil][c] * d.areaCuencaKm2) / 1000;
  });
}

/**
 * Factores q(FF%)/q de la Regionalización de estadísticas de caudales
 * (Dinagua, 2025), subregión Sur / Sureste. Son un valor de partida: para
 * otra subregión hay que cargar los de su columna en las figuras 12 a 14.
 */
export const FACTORES_PERCENTIL_S_SE: Record<Percentil, [number, number, number]> = {
  Q60: [0.199, 0.294, 0.143],
  Q70: [0.131, 0.221, 0.101],
  Q80: [0.082, 0.158, 0.073],
  Q90: [0.045, 0.098, 0.048],
};

// ── Balance ────────────────────────────────────────────────────────────────

/** Tolerancia para contar un paso como cubierto: medio metro cúbico. */
const TOL_HM3 = 0.5e-6;

export function calcularBalance(datos: DatosBalance): ResultadoBalance {
  const { curva, volumenMinimoHm3: vMin, volumenMaximoHm3: vMax } = datos;
  const pasos: PasoBalance[] = [];
  let v = datos.volumenInicialHm3;
  let racha = 0;
  let rachaMaximaFalla = 0;

  datos.serie.forEach((reg, indice) => {
    const duracionS = duracionPasoS(reg.fecha, datos.paso);
    const aVolumen = (q: number) => (datos.unidadCaudal === "m3s" ? caudalAVolumenHm3(q, duracionS) : q / 1e6);
    const aporteHm3 = aVolumen(reg.aporte);
    const demandaHm3 = aVolumen(reg.extraccion);
    const mes0 = Number(reg.fecha.slice(5, 7)) - 1;
    const qambExigidoHm3 = caudalAVolumenHm3(datos.qambPorMesM3s[mes0] ?? 0, duracionS);
    const qambObjetivoHm3 =
      datos.modoLiberacion === "minimo-aporte" ? Math.min(qambExigidoHm3, aporteHm3) : qambExigidoHm3;

    const operar = (areaHa: number) => {
      const precipitacionHm3 = laminaAVolumenHm3(reg.precipitacionMm, areaHa);
      const bruto = v + aporteHm3 + precipitacionHm3;
      const evaporacionHm3 = Math.min(laminaAVolumenHm3(reg.evaporacionMm * datos.coefEvaporacion, areaHa), bruto);
      const infiltracionHm3 = Math.min(caudalAVolumenHm3(datos.infiltracionM3s, duracionS), bruto - evaporacionHm3);
      const disponibleHm3 = bruto - evaporacionHm3 - infiltracionHm3;
      const qambLiberadoHm3 = Math.min(qambObjetivoHm3, disponibleHm3);
      const suministroHm3 = Math.max(0, Math.min(demandaHm3, disponibleHm3 - qambLiberadoHm3 - vMin));
      const vertidoHm3 = Math.max(0, disponibleHm3 - qambLiberadoHm3 - suministroHm3 - vMax);
      const volumenFinalHm3 = disponibleHm3 - qambLiberadoHm3 - suministroHm3 - vertidoHm3;
      return {
        precipitacionHm3,
        evaporacionHm3,
        infiltracionHm3,
        disponibleHm3,
        qambLiberadoHm3,
        suministroHm3,
        vertidoHm3,
        volumenFinalHm3,
      };
    };

    let volumenAreaHm3 = v;
    let areaHa = areaDeVolumen(curva, v);
    let r = operar(areaHa);
    let iteraciones = 1;
    if (datos.areaEnPaso === "medio") {
      for (; iteraciones < 50; iteraciones++) {
        volumenAreaHm3 = (v + r.volumenFinalHm3) / 2;
        const nueva = areaDeVolumen(curva, volumenAreaHm3);
        const cambio = Math.abs(nueva - areaHa);
        areaHa = nueva;
        r = operar(areaHa);
        if (cambio < 1e-9 * Math.max(1, areaHa)) break;
      }
    }

    const deficitHm3 = Math.max(0, demandaHm3 - r.suministroHm3);
    const salidaAguasAbajoHm3 = r.qambLiberadoHm3 + r.vertidoHm3;
    const cumpleDemanda = r.suministroHm3 >= demandaHm3 - TOL_HM3;
    racha = cumpleDemanda ? 0 : racha + 1;
    rachaMaximaFalla = Math.max(rachaMaximaFalla, racha);

    pasos.push({
      indice,
      fecha: reg.fecha,
      duracionS,
      volumenInicialHm3: v,
      cotaInicialM: cotaDeVolumen(curva, v),
      areaHa,
      volumenAreaHm3,
      aporteHm3,
      ...r,
      qambExigidoHm3,
      qambObjetivoHm3,
      demandaHm3,
      deficitHm3,
      salidaAguasAbajoHm3,
      cotaFinalM: cotaDeVolumen(curva, r.volumenFinalHm3),
      cumpleDemanda,
      cumpleQamb: salidaAguasAbajoHm3 >= qambExigidoHm3 - TOL_HM3,
      iteraciones,
    });
    v = r.volumenFinalHm3;
  });

  let iMin = 0;
  let iMax = 0;
  pasos.forEach((p, i) => {
    if (p.volumenFinalHm3 < pasos[iMin].volumenFinalHm3) iMin = i;
    if (p.volumenFinalHm3 > pasos[iMax].volumenFinalHm3) iMax = i;
  });
  const suma = (f: (p: PasoBalance) => number) => pasos.reduce((s, p) => s + f(p), 0);
  const n = pasos.length || 1;
  const totales = {
    aporte: suma((p) => p.aporteHm3),
    precipitacion: suma((p) => p.precipitacionHm3),
    evaporacion: suma((p) => p.evaporacionHm3),
    infiltracion: suma((p) => p.infiltracionHm3),
    qambLiberado: suma((p) => p.qambLiberadoHm3),
    demanda: suma((p) => p.demandaHm3),
    suministro: suma((p) => p.suministroHm3),
    vertido: suma((p) => p.vertidoHm3),
  };
  const vFinal = pasos.length ? pasos[pasos.length - 1].volumenFinalHm3 : datos.volumenInicialHm3;

  return {
    pasos,
    volumenMinimo: { valorHm3: pasos[iMin]?.volumenFinalHm3 ?? NaN, fecha: pasos[iMin]?.fecha ?? "" },
    volumenMaximo: { valorHm3: pasos[iMax]?.volumenFinalHm3 ?? NaN, fecha: pasos[iMax]?.fecha ?? "" },
    cotaMinimaM: pasos[iMin]?.cotaFinalM ?? NaN,
    cotaMaximaM: pasos[iMax]?.cotaFinalM ?? NaN,
    pasosConDeficit: pasos.filter((p) => !p.cumpleDemanda).length,
    pasosConVertido: pasos.filter((p) => p.vertidoHm3 > TOL_HM3).length,
    rachaMaximaFalla,
    deficitMaximoHm3: Math.max(0, ...pasos.map((p) => p.deficitHm3)),
    deficitTotalHm3: suma((p) => p.deficitHm3),
    vertidoTotalHm3: totales.vertido,
    garantiaTemporal: pasos.filter((p) => p.cumpleDemanda).length / n,
    garantiaVolumetrica: totales.demanda > 0 ? totales.suministro / totales.demanda : 1,
    cumplimientoQamb: pasos.filter((p) => p.cumpleQamb).length / n,
    totales,
    cierreHm3:
      datos.volumenInicialHm3 +
      totales.aporte +
      totales.precipitacion -
      totales.evaporacion -
      totales.infiltracion -
      totales.qambLiberado -
      totales.suministro -
      totales.vertido -
      vFinal,
  };
}

// ── Sensibilidad a la demanda ──────────────────────────────────────────────

export interface EscenarioDemanda {
  /** Demanda constante, en la unidad de la serie (m³/s o m³ del paso). */
  demanda: number;
  garantiaTemporal: number;
  garantiaVolumetrica: number;
  pasosConFalla: number;
  rachaMaximaFalla: number;
  deficitMaximoHm3: number;
  cumplimientoQamb: number;
  volumenMinimoHm3: number;
}

export function balanceConDemanda(datos: DatosBalance, demanda: number): ResultadoBalance {
  return calcularBalance({ ...datos, serie: datos.serie.map((r) => ({ ...r, extraccion: demanda })) });
}

/** Corre el balance con cada demanda constante y resume el desempeño. */
export function sensibilidadDemanda(datos: DatosBalance, demandas: readonly number[]): EscenarioDemanda[] {
  return demandas.map((demanda) => {
    const r = balanceConDemanda(datos, demanda);
    return {
      demanda,
      garantiaTemporal: r.garantiaTemporal,
      garantiaVolumetrica: r.garantiaVolumetrica,
      pasosConFalla: r.pasosConDeficit,
      rachaMaximaFalla: r.rachaMaximaFalla,
      deficitMaximoHm3: r.deficitMaximoHm3,
      cumplimientoQamb: r.cumplimientoQamb,
      volumenMinimoHm3: r.volumenMinimo.valorHm3,
    };
  });
}

/**
 * Demanda constante máxima que todavía cumple la garantía pedida (temporal o
 * volumétrica), por bisección: la garantía no crece al subir la demanda.
 * Devuelve 0 si ni con demanda nula se cumple (p. ej. por el caudal ambiental).
 */
export function demandaFirme(
  datos: DatosBalance,
  garantia: number,
  criterio: "temporal" | "volumetrica"
): number {
  const cumple = (d: number) => {
    const r = balanceConDemanda(datos, d);
    return (criterio === "temporal" ? r.garantiaTemporal : r.garantiaVolumetrica) >= garantia - 1e-12;
  };
  const aporteMedio = datos.serie.reduce((s, r) => s + r.aporte, 0) / Math.max(1, datos.serie.length);
  let lo = 0;
  let hi = Math.max(aporteMedio, 1e-9);
  let vueltas = 0;
  while (cumple(hi) && vueltas++ < 40) {
    lo = hi;
    hi *= 2;
  }
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (cumple(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ── Agregación de datos diarios a mensuales ────────────────────────────────

/**
 * Pasa una serie diaria (fecha, aporte, P, E, demanda, ETP) a mensual, como
 * se hace con los datos de una estación meteorológica:
 *   - P: suma de los días con dato (no se rellena);
 *   - E y ETP: promedio de los días con dato × días del mes (se completan los
 *     días faltantes con el promedio del mes);
 *   - aporte y demanda: promedio si están en m³/s, suma si son volúmenes.
 * Devuelve las filas mensuales y, por mes, cuántos días faltan de cada variable.
 */
export function agregarDiarioAMensual(
  filas: readonly string[][],
  unidadCaudal: UnidadCaudalSerie
): { filas: string[][]; faltantes: { mes: string; p: number; e: number; etp: number }[] } {
  const meses = new Map<string, { dias: number; vals: number[][]; fechas: Set<number> }>();
  for (const f of filas) {
    const fecha = fechaDeCelda(f[0] ?? "");
    if (!fecha) continue;
    const clave = `${fecha.anio}-${String(fecha.mes).padStart(2, "0")}`;
    const m = meses.get(clave) ?? { dias: diasDelMes(fecha.anio, fecha.mes), vals: [[], [], [], [], []], fechas: new Set<number>() };
    if (m.fechas.has(fecha.dia)) continue; // día repetido: se toma el primero
    m.fechas.add(fecha.dia);
    [1, 2, 3, 4, 5].forEach((j, k) => {
      const v = numeroDeCelda(f[j] ?? "");
      if (v !== null && !Number.isNaN(v)) m.vals[k].push(v);
    });
    meses.set(clave, m);
  }
  const txt = (n: number) => (Number.isFinite(n) ? String(+n.toPrecision(12)).replace(".", ",") : "");
  const suma = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const media = (a: number[]) => (a.length ? suma(a) / a.length : NaN);
  const caudal = (a: number[], dias: number) =>
    a.length === 0 ? NaN : unidadCaudal === "m3s" ? media(a) : (suma(a) / a.length) * dias;
  const salida: string[][] = [];
  const faltantes: { mes: string; p: number; e: number; etp: number }[] = [];
  for (const clave of [...meses.keys()].sort()) {
    const m = meses.get(clave)!;
    const [ap, p, e, dem, etp] = m.vals;
    salida.push([
      `${clave}-01`,
      txt(caudal(ap, m.dias)),
      p.length ? txt(suma(p)) : "",
      txt(media(e) * m.dias),
      txt(caudal(dem, m.dias)),
      txt(media(etp) * m.dias),
    ]);
    const f = { mes: clave, p: m.dias - p.length, e: m.dias - e.length, etp: m.dias - etp.length };
    if (f.p > 0 || (e.length > 0 && f.e > 0) || (etp.length > 0 && f.etp > 0)) faltantes.push(f);
  }
  return { filas: salida, faltantes };
}

// ── Columnas y validación de las tablas de entrada ─────────────────────────

/** Qué columnas de la serie hacen falta según cómo se arma el balance. */
export interface ColumnasRequeridas {
  /** Falta si el aporte sale del modelo de Témez. */
  aporte: boolean;
  /** Falta si la demanda es constante. */
  demanda: boolean;
  /** Hace falta para Témez. */
  etp: boolean;
}

export const TODAS_LAS_COLUMNAS: ColumnasRequeridas = { aporte: true, demanda: true, etp: false };

export function especsSerie(r: ColumnasRequeridas): EspecColumna[] {
  return COLUMNAS_SERIE.map((c) =>
    c.clave === "aporte"
      ? { ...c, obligatoria: r.aporte }
      : c.clave === "extraccion"
        ? { ...c, obligatoria: r.demanda }
        : c.clave === "etpMm"
          ? { ...c, obligatoria: r.etp }
          : c
  );
}

export type UnidadCaudalArchivo = "m3s" | "ls" | "m3" | "hm3";

/**
 * Unidad que declara el encabezado de una columna de caudal, si declara
 * alguna: "aporte_m3s" → m³/s, "aporte (L/s)" → L/s, "aporte (m³/mes)" → m³
 * del paso, "aporte_hm3" → hm³ del paso.
 */
export function unidadCaudalDeEncabezado(normalizado: string): UnidadCaudalArchivo | null {
  if (/(^|_)m3_?s(eg)?($|_)/.test(normalizado)) return "m3s";
  if (/(^|_)l_?s($|_)/.test(normalizado)) return "ls";
  if (/(^|_)hm3($|_)/.test(normalizado)) return "hm3";
  if (/(^|_)m3($|_)/.test(normalizado)) return "m3";
  return null;
}

/** Pasa un caudal leído en `de` a la unidad de la serie (m³/s o m³ del paso). */
export function convertirCaudalSerie(
  valor: number,
  de: UnidadCaudalArchivo,
  a: UnidadCaudalSerie,
  duracionS: number
): number {
  const m3 = de === "m3s" ? valor * duracionS : de === "ls" ? (valor / 1000) * duracionS : de === "hm3" ? valor * 1e6 : valor;
  return a === "m3s" ? m3 / duracionS : m3;
}

/** Unidad de volumen o área que declara un encabezado de la curva. */
export function unidadCurvaDeEncabezado(normalizado: string): "hm3" | "m3" | "ha" | "m2" | "km2" | null {
  if (/(^|_)hm3($|_)/.test(normalizado)) return "hm3";
  if (/(^|_)m3($|_)/.test(normalizado)) return "m3";
  if (/(^|_)km2($|_)/.test(normalizado)) return "km2";
  if (/(^|_)m2($|_)/.test(normalizado)) return "m2";
  if (/(^|_)ha($|_)/.test(normalizado)) return "ha";
  return null;
}

export const COLUMNAS_SERIE: readonly EspecColumna[] = [
  { clave: "fecha", nombre: "fecha", alias: ["fechas", "date", "mes", "dia", "periodo"], obligatoria: true, tipo: "fecha" },
  {
    clave: "aporte",
    nombre: "aporte",
    alias: ["aportes", "caudal", "caudal_medio", "q", "q_aporte", "afluente", "afluencia", "ingreso"],
    obligatoria: true,
    tipo: "numero",
  },
  {
    clave: "precipitacionMm",
    nombre: "precipitacion_mm",
    alias: ["precipitacion", "precipitaciones", "lluvia", "pp", "p"],
    obligatoria: true,
    tipo: "numero",
  },
  {
    clave: "evaporacionMm",
    nombre: "evaporacion_mm",
    alias: ["evaporacion", "evap", "ev", "e"],
    obligatoria: true,
    tipo: "numero",
  },
  {
    clave: "extraccion",
    nombre: "extraccion",
    alias: ["extracciones", "demanda", "suministro", "toma", "q_extraccion", "consumo"],
    obligatoria: true,
    tipo: "numero",
  },
  {
    clave: "etpMm",
    nombre: "etp_mm",
    alias: ["etp", "eto", "et0", "evapotranspiracion", "evapotranspiracion_potencial"],
    obligatoria: false,
    tipo: "numero",
  },
];

export const COLUMNAS_CURVA: readonly EspecColumna[] = [
  { clave: "cotaM", nombre: "cota_m", alias: ["cota", "nivel", "elevacion", "h"], obligatoria: true, tipo: "numero" },
  { clave: "areaHa", nombre: "area_ha", alias: ["area", "superficie", "espejo", "a"], obligatoria: true, tipo: "numero" },
  {
    clave: "volumenHm3",
    nombre: "volumen_hm3",
    alias: ["volumen", "vol", "almacenamiento", "v"],
    obligatoria: true,
    tipo: "numero",
  },
];

/** Hasta cuántos errores se listan uno por uno antes de resumir. */
const MAX_ERRORES = 15;

function listaConTope(errores: string[]): string[] {
  if (errores.length <= MAX_ERRORES) return errores;
  return [...errores.slice(0, MAX_ERRORES), `… y ${errores.length - MAX_ERRORES} errores más.`];
}

const NOMBRE_CAMPO_SERIE: Record<string, string> = {
  aporte: "aporte",
  precipitacionMm: "precipitación",
  evaporacionMm: "evaporación",
  extraccion: "demanda",
  etpMm: "ETP",
};

function sumarPaso(fecha: { anio: number; mes: number; dia: number }, paso: PasoTiempo) {
  if (paso === "mensual") {
    return fecha.mes === 12 ? { anio: fecha.anio + 1, mes: 1, dia: 1 } : { ...fecha, mes: fecha.mes + 1, dia: 1 };
  }
  const d = new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia + 1));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

const iso = (f: { anio: number; mes: number; dia: number }) =>
  `${f.anio}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`;

/**
 * Revisa la serie fila por fila: fechas legibles, en orden, sin repetidas y
 * sin huecos para el paso elegido; valores numéricos y no negativos.
 * `filas` sigue el orden de COLUMNAS_SERIE; `numeroFila` da el número de fila
 * que se muestra en los mensajes (el del archivo, o el de la tabla).
 */
export function validarSerie(
  filas: readonly string[][],
  paso: PasoTiempo,
  numeroFila: (i: number) => number = (i) => i + 1,
  requeridas: ColumnasRequeridas = TODAS_LAS_COLUMNAS
): { serie: RegistroSerie[] | null; errores: string[] } {
  const errores: string[] = [];
  if (filas.length === 0) return { serie: null, errores: ["La serie no tiene ningún paso cargado."] };

  const serie: RegistroSerie[] = [];
  const fechas: ({ anio: number; mes: number; dia: number } | null)[] = [];

  filas.forEach((fila, i) => {
    const n = numeroFila(i);
    const fecha = fechaDeCelda(fila[0] ?? "");
    if (!fecha) {
      errores.push(
        fila[0]?.trim()
          ? `Fila ${n}: la fecha «${fila[0]}» no se reconoce. Usá aaaa-mm-dd o dd/mm/aaaa.`
          : `Fila ${n}: falta la fecha.`
      );
    } else if (paso === "mensual") {
      // En paso mensual el día no importa: cualquier fecha del mes representa al mes.
      fecha.dia = 1;
    }
    fechas.push(fecha);

    const valores: Record<string, number> = {};
    COLUMNAS_SERIE.slice(1).forEach((col, j) => {
      const texto = fila[j + 1] ?? "";
      const num = numeroDeCelda(texto);
      const nombre = NOMBRE_CAMPO_SERIE[col.clave];
      const usada =
        col.clave === "aporte" ? requeridas.aporte : col.clave === "extraccion" ? requeridas.demanda : col.clave === "etpMm" ? requeridas.etp : true;
      if (!usada) {
        valores[col.clave] = num === null || Number.isNaN(num) ? NaN : num;
        return;
      }
      if (num === null) errores.push(`Fila ${n}: falta el valor de ${nombre}.`);
      else if (Number.isNaN(num)) errores.push(`Fila ${n}: ${nombre} «${texto}» no es un número.`);
      else if (num < 0) errores.push(`Fila ${n}: ${nombre} negativo (${texto}). Los valores tienen que ser ≥ 0.`);
      valores[col.clave] = num ?? NaN;
    });

    serie.push({
      fecha: fecha ? iso(fecha) : "",
      aporte: valores.aporte,
      precipitacionMm: valores.precipitacionMm,
      evaporacionMm: valores.evaporacionMm,
      extraccion: valores.extraccion,
      etpMm: valores.etpMm,
    });
  });

  // Orden, duplicados y huecos, sólo entre fechas legibles.
  const faltantes: string[] = [];
  for (let i = 1; i < fechas.length; i++) {
    const anterior = fechas[i - 1];
    const actual = fechas[i];
    if (!anterior || !actual) continue;
    const a = iso(anterior);
    const b = iso(actual);
    if (b === a) {
      errores.push(`Fila ${numeroFila(i)}: la fecha ${b} está repetida.`);
    } else if (b < a) {
      errores.push(`Fila ${numeroFila(i)}: la fecha ${b} es anterior a la de la fila anterior (${a}); la serie tiene que ir en orden cronológico.`);
    } else {
      let esperada = sumarPaso(anterior, paso);
      let guardas = 0;
      while (iso(esperada) < b && guardas++ < 100_000) {
        faltantes.push(paso === "mensual" ? iso(esperada).slice(0, 7) : iso(esperada));
        esperada = sumarPaso(esperada, paso);
      }
    }
  }
  if (faltantes.length > 0) {
    const muestra = faltantes.slice(0, 8).join(", ");
    errores.push(
      `${faltantes.length > 1 ? "Faltan" : "Falta"} ${faltantes.length} ${paso === "mensual" ? "mes" : "día"}${faltantes.length > 1 ? (paso === "mensual" ? "es" : "s") : ""} en la serie: ${muestra}${faltantes.length > 8 ? "…" : ""}. Completalos (aunque sea con 0) para que el balance no salte pasos.`
    );
  }

  return { serie: errores.length === 0 ? serie : null, errores: listaConTope(errores) };
}

/** Curva cota-área-volumen: al menos dos puntos, cota y volumen crecientes, nada negativo. */
export function validarCurva(
  filas: readonly string[][],
  numeroFila: (i: number) => number = (i) => i + 1
): { curva: PuntoCurva[] | null; errores: string[] } {
  const errores: string[] = [];
  const curva: PuntoCurva[] = [];
  const nombres = ["cota", "área", "volumen"];

  filas.forEach((fila, i) => {
    const n = numeroFila(i);
    const v = [0, 1, 2].map((j) => {
      const texto = fila[j] ?? "";
      const num = numeroDeCelda(texto);
      if (num === null) errores.push(`Fila ${n}: falta ${nombres[j]}.`);
      else if (Number.isNaN(num)) errores.push(`Fila ${n}: ${nombres[j]} «${texto}» no es un número.`);
      else if (j > 0 && num < 0) errores.push(`Fila ${n}: ${nombres[j]} negativo (${texto}).`);
      return num ?? NaN;
    });
    curva.push({ cotaM: v[0], areaHa: v[1], volumenHm3: v[2] });
  });

  if (curva.length < 2) errores.push("La curva necesita al menos dos puntos.");
  for (let i = 1; i < curva.length; i++) {
    if (!(curva[i].cotaM > curva[i - 1].cotaM)) {
      errores.push(`Fila ${numeroFila(i)}: la cota tiene que ser mayor que la de la fila anterior.`);
    }
    if (!(curva[i].volumenHm3 > curva[i - 1].volumenHm3)) {
      errores.push(`Fila ${numeroFila(i)}: el volumen tiene que ser mayor que el de la fila anterior.`);
    }
  }

  return { curva: errores.length === 0 ? curva : null, errores: listaConTope(errores) };
}

// ── Plantillas ─────────────────────────────────────────────────────────────

/**
 * Serie de ejemplo para la plantilla y para arrancar la calculadora con algo
 * que se vea: un año hidrológico con estiaje en verano. Los valores son
 * ilustrativos, no de ninguna cuenca real.
 */
const LLUVIA_DIARIA_EJEMPLO: Record<number, number> = { 3: 18, 4: 6, 12: 25, 13: 9, 21: 4, 27: 32 };

export function serieEjemplo(paso: PasoTiempo): string[][] {
  if (paso === "mensual") {
    const aporte = [3.2, 2.6, 2.4, 2.9, 4.1, 5.6, 6.8, 6.2, 5.1, 4.4, 3.8, 3.4];
    const precip = [95, 88, 102, 70, 45, 30, 22, 25, 40, 72, 85, 98];
    const evap = [210, 170, 140, 90, 60, 40, 45, 70, 100, 140, 180, 215];
    const extr = [3.6, 3.6, 3.2, 2.6, 2.0, 1.8, 1.8, 2.0, 2.4, 2.9, 3.3, 3.6];
    const etp = [190, 150, 120, 75, 50, 35, 38, 55, 80, 115, 150, 185];
    const filas: string[][] = [];
    for (let k = 0; k < 24; k++) {
      const m = k % 12;
      const anio = 2024 + Math.floor(k / 12);
      const f = k < 12 ? 1 : 0.75; // segundo año más seco
      filas.push([
        `${anio}-${String(m + 1).padStart(2, "0")}-01`,
        texto(+(aporte[m] * f).toFixed(2)),
        texto(Math.round(precip[m] * f)),
        texto(evap[m]),
        texto(extr[m]),
        texto(etp[m]),
      ]);
    }
    return filas;
  }
  const filas: string[][] = [];
  for (let d = 1; d <= 31; d++) {
    const lluvia = LLUVIA_DIARIA_EJEMPLO[d] ?? 0;
    filas.push([
      `2025-01-${String(d).padStart(2, "0")}`,
      texto(+(2.4 + 0.9 * Math.sin(d / 5) + lluvia * 0.05).toFixed(2)),
      texto(lluvia),
      texto(+(6.5 + 0.8 * Math.cos(d / 4)).toFixed(1)),
      texto(3.4),
      texto(+(5.6 + 0.6 * Math.cos(d / 4)).toFixed(1)),
    ]);
  }
  return filas;
}

export const CURVA_EJEMPLO: string[][] = [
  ["310", "0", "0"],
  ["312", "35", "0,3"],
  ["314", "90", "1,5"],
  ["316", "160", "4"],
  ["318", "240", "8"],
  ["320", "330", "13,7"],
  ["322", "430", "21,3"],
  ["324", "540", "31"],
];

function texto(n: number): string {
  return String(n).replace(".", ",");
}
