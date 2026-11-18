import { numeroDeCelda, type EspecColumna } from "@/lib/calculadoras/tablas";
import { coefDuracion, coefArea, coefTr } from "@/lib/calc/hidraulica/tormenta";

/**
 * Medidas de control de escurrimiento (MCE): lo que se calcula antes y después
 * de modelar el amortiguador en SWMM.
 *
 * Antes de SWMM
 *   - Coeficiente de escorrentía ponderado por superficie impermeable:
 *       C = (C_imp·A_imp + C_perm·(A − A_imp)) / A
 *     en la situación de proyecto y en la previa (FIS), donde el área
 *     impermeable previa se limita a un porcentaje máximo del predio.
 *   - Tiempo de concentración: Kirpich, Desbordes o FAA, con un mínimo.
 *   - Hidrograma unitario sintético triangular para lluvia neta de 1 mm
 *     en un intervalo D:
 *       Tp = D/2 + k_p·Tc ;  Tb = k_b·Tp ;  Qp = 2·A·(1 mm) / Tb
 *   - Convolución con la tormenta de diseño (lluvia neta = C·P) a paso de
 *     1 minuto, para cada período de retorno: hidrogramas de proyecto,
 *     de la situación previa, del área que va al amortiguador y del área
 *     que descarga sin amortiguar.
 *   - Caudal y volumen a amortiguar: lo que el proyecto supera el pico de la
 *     situación previa.
 *
 * Después de SWMM
 *   - Se pega la salida del amortiguador (tiempo y caudal), se le suma el
 *     hidrograma del área sin amortiguar y se compara el pico con el de la
 *     situación previa.
 */

// ── Coeficientes y áreas ────────────────────────────────────────────────────

export interface DatosPredio {
  /** Área catastral (m²). */
  areaCatastralM2: number;
  /** Área que se modela en el EIT (m²); las subcuencas se corrigen por A_EIT / A_catastral. */
  areaEitM2: number;
  /** Área libre de afectaciones (m²): la de la situación previa. */
  areaLibreM2: number;
  /** Área impermeable del proyecto (m²). */
  areaImpProyectoM2: number;
  /** Área impermeable de la situación previa (m²). */
  areaImpPreviaM2: number;
  /** Porcentaje máximo de área impermeable admitido para la situación previa. */
  porcImpMaxPrevia: number;
  cImp: number;
  cPerm: number;
  /** Área que descarga al amortiguador (m², sin corregir). */
  areaAmortM2: number;
  /** Área impermeable del área sin amortiguar (m²). */
  areaImpSinAmortM2: number;
}

export const cPonderado = (cImp: number, cPerm: number, aImp: number, a: number) => (cImp * aImp + cPerm * (a - aImp)) / a;

export interface Subcuenca {
  nombre: string;
  areaM2: number;
  areaImpM2: number;
  c: number;
}

export interface Coeficientes {
  porcImpProyecto: number;
  porcImpPrevia: number;
  areaImpPreviaM2: number;
  factorArea: number;
  proyecto: Subcuenca;
  previa: Subcuenca;
  amortiguada: Subcuenca;
  sinAmortiguar: Subcuenca;
}

export function coeficientes(d: DatosPredio): Coeficientes {
  const porcImpProyecto = (d.areaImpProyectoM2 / d.areaLibreM2) * 100;
  const porcImpPrevia = Math.min(d.porcImpMaxPrevia, (d.areaImpPreviaM2 / d.areaLibreM2) * 100);
  const areaImpPreviaM2 = (porcImpPrevia * d.areaLibreM2) / 100;
  const factorArea = d.areaEitM2 / d.areaCatastralM2;
  const aAmort = d.areaAmortM2 * factorArea;
  const aSin = (d.areaCatastralM2 - d.areaAmortM2) * factorArea;
  return {
    porcImpProyecto,
    porcImpPrevia,
    areaImpPreviaM2,
    factorArea,
    proyecto: {
      nombre: "Proyecto",
      areaM2: d.areaEitM2,
      areaImpM2: d.areaImpProyectoM2,
      c: cPonderado(d.cImp, d.cPerm, d.areaImpProyectoM2, d.areaEitM2),
    },
    previa: {
      nombre: "Situación previa (FIS)",
      areaM2: d.areaLibreM2,
      areaImpM2: areaImpPreviaM2,
      c: cPonderado(d.cImp, d.cPerm, areaImpPreviaM2, d.areaLibreM2),
    },
    amortiguada: {
      nombre: "Al amortiguador",
      areaM2: aAmort,
      areaImpM2: d.areaImpProyectoM2,
      c: cPonderado(d.cImp, d.cPerm, d.areaImpProyectoM2, aAmort),
    },
    sinAmortiguar: {
      nombre: "Sin amortiguar",
      areaM2: aSin,
      areaImpM2: d.areaImpSinAmortM2,
      c: aSin > 0 ? cPonderado(d.cImp, d.cPerm, d.areaImpSinAmortM2, aSin) : d.cPerm,
    },
  };
}

// ── Tiempo de concentración ─────────────────────────────────────────────────

/** Kirpich: Tc (h) = 0,066·L^0,77 / S^0,385, con L en km y S en m/m. */
export const tcKirpichH = (lKm: number, s: number) => (0.066 * lKm ** 0.77) / s ** 0.385;
/** Desbordes: Tc (min) = 6,625·A^0,3·S^−0,38·C^−0,45, con A en ha y S en %. */
export const tcDesbordesMin = (aHa: number, sPorc: number, c: number) => 6.625 * aHa ** 0.3 * sPorc ** -0.38 * c ** -0.45;
/** FAA: Tc (h) = 0,054·(1,1 − C)·L^0,5 / S^0,333, con L en m y S en %. */
export const tcFaaH = (lM: number, sPorc: number, c: number) => (0.054 * (1.1 - c) * lM ** 0.5) / sPorc ** 0.333;

// ── Hidrograma unitario triangular y convolución ────────────────────────────

export interface ParametrosHu {
  /** Intervalo de la tormenta (min). */
  dMin: number;
  /** Tp = D/2 + kTp·Tc. */
  kTp: number;
  /** Tb = kTb·Tp. */
  kTb: number;
}

export interface HidrogramaUnitario {
  dH: number;
  tpH: number;
  tbH: number;
  /** Caudal pico por mm de lluvia neta (m³/s/mm). */
  qpPorMm: number;
}

export function hidrogramaUnitario(areaM2: number, tcH: number, p: ParametrosHu): HidrogramaUnitario {
  const dH = p.dMin / 60;
  const tpH = dH / 2 + p.kTp * tcH;
  const tbH = p.kTb * tpH;
  // Volumen de 1 mm sobre el área (A_ha·10 m³) repartido en un triángulo de base Tb.
  const qpPorMm = (2 * (areaM2 / 10_000) * 10) / (3600 * tbH);
  return { dH, tpH, tbH, qpPorMm };
}

/**
 * Hidrograma a paso de 1 minuto: suma de un triángulo por pulso de lluvia.
 * El pulso k arranca en k·D y aporta Qp·D·i_neta (i en mm/h, D en h).
 */
export function convolucion(hu: HidrogramaUnitario, intensidadNetaMmH: readonly number[], minutos: number): number[] {
  const q = new Array<number>(minutos + 1).fill(0);
  intensidadNetaMmH.forEach((i, k) => {
    if (i === 0) return;
    const s = k * hu.dH;
    const alto = hu.qpPorMm * hu.dH * i;
    const m0 = Math.max(0, Math.ceil(s * 60));
    const m1 = Math.min(minutos, Math.floor((s + hu.tbH) * 60));
    for (let m = m0; m <= m1; m++) {
      const t = m / 60;
      q[m] += t < s + hu.tpH ? (alto * (t - s)) / hu.tpH : ((s + hu.tbH - t) * alto) / (hu.tbH - hu.tpH);
    }
  });
  return q;
}

export interface Pico {
  q: number;
  tH: number;
}

export function pico(q: readonly number[]): Pico {
  let k = 0;
  for (let i = 1; i < q.length; i++) if (q[i] > q[k]) k = i;
  return { q: q[k] ?? 0, tH: k / 60 };
}

/** Volumen por encima de un caudal (m³), con paso de 1 minuto. */
export function volumenSobre(q: readonly number[], umbral: number): number {
  let v = 0;
  for (let i = 1; i < q.length; i++) v += 60 * Math.max(0, q[i] - umbral);
  return v;
}

/** Volumen de un hidrograma (m³), paso de 1 minuto, por trapecios. */
export function volumen(q: readonly number[]): number {
  let v = 0;
  for (let i = 1; i < q.length; i++) v += 30 * (q[i] + q[i - 1]);
  return v;
}

export const ESCENARIOS = ["proyecto", "previa", "amortiguada", "sinAmortiguar"] as const;
export type Escenario = (typeof ESCENARIOS)[number];

export interface ResultadoMce {
  coef: Coeficientes;
  tc: { proyectoH: number; previaH: number };
  hu: Record<Escenario, HidrogramaUnitario>;
  minutos: number;
  /** Hidrogramas por escenario y por tormenta (mismo orden que las tormentas). */
  q: Record<Escenario, number[][]>;
  picos: Record<Escenario, Pico[]>;
}

export function calcularMce(
  coef: Coeficientes,
  tcProyectoH: number,
  tcPreviaH: number,
  hu: ParametrosHu,
  tormentasMmH: readonly (readonly number[])[]
): ResultadoMce {
  const subcuencas: Record<Escenario, [Subcuenca, number]> = {
    proyecto: [coef.proyecto, tcProyectoH],
    previa: [coef.previa, tcPreviaH],
    amortiguada: [coef.amortiguada, tcProyectoH],
    sinAmortiguar: [coef.sinAmortiguar, tcProyectoH],
  };
  const hus = Object.fromEntries(ESCENARIOS.map((e) => [e, hidrogramaUnitario(subcuencas[e][0].areaM2, subcuencas[e][1], hu)])) as Record<
    Escenario,
    HidrogramaUnitario
  >;
  const nPulsos = Math.max(0, ...tormentasMmH.map((t) => t.length));
  const tbMax = Math.max(...ESCENARIOS.map((e) => hus[e].tbH));
  const minutos = Math.ceil((nPulsos * hu.dMin) + tbMax * 60);
  const q = {} as Record<Escenario, number[][]>;
  const picos = {} as Record<Escenario, Pico[]>;
  for (const e of ESCENARIOS) {
    const c = subcuencas[e][0].c;
    q[e] = tormentasMmH.map((t) =>
      convolucion(
        hus[e],
        t.map((i) => i * c),
        minutos
      )
    );
    picos[e] = q[e].map(pico);
  }
  return { coef, tc: { proyectoH: tcProyectoH, previaH: tcPreviaH }, hu: hus, minutos, q, picos };
}

/** Método racional con una IDF de Montana i (mm/min) = a·t^(−b), t en min: Q = i·A(ha)·C/6. */
export const qRacionalMontana = (a: number, b: number, tcMin: number, aHa: number, c: number) => (a * tcMin ** -b * aHa * c * 10) / 60;

// ── Tormenta de diseño por bloques alternos ─────────────────────────────────

/**
 * Hietograma de bloques alternos con Rodríguez Fontal: láminas acumuladas
 * P(k·D), incrementos ordenados de mayor a menor y ubicados alrededor del
 * pico (el 2º a la derecha, el 3º a la izquierda, …). Devuelve mm/h.
 */
export function bloquesAlternos(p310Mm: number, T: number, areaKm2: number, duracionMin: number, dMin: number, posicionPico: number): number[] {
  const n = Math.max(1, Math.round(duracionMin / dMin));
  const acum = Array.from({ length: n + 1 }, (_, k) => {
    if (k === 0) return 0;
    const dH = (k * dMin) / 60;
    return p310Mm * coefTr(T) * coefDuracion(dH) * coefArea(areaKm2, dH);
  });
  const inc = acum.slice(1).map((p, k) => p - acum[k]).sort((a, b) => b - a);
  const out = new Array<number>(n).fill(0);
  const ip = Math.min(n - 1, Math.max(0, Math.round(posicionPico * n - 0.5)));
  let izq = ip - 1;
  let der = ip + 1;
  out[ip] = inc[0];
  for (let k = 1; k < n; k++) {
    const aDerecha = (k % 2 === 1 && der < n) || izq < 0;
    if (aDerecha) out[der++] = inc[k];
    else out[izq--] = inc[k];
  }
  return out.map((mm) => (mm * 60) / dMin);
}

// ── Formato de tiempo para SWMM ─────────────────────────────────────────────

/** Minutos → "H:MM" (formato de series de tiempo de SWMM). */
export function horaSwmm(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Serie de tiempo para un archivo externo de SWMM (.dat): "H:MM valor" por línea. */
export function serieSwmm(titulo: string, valores: readonly number[], pasoMin: number, decimales = 5): string {
  const lineas = [`;${titulo}`, ...valores.map((v, i) => `${horaSwmm(i * pasoMin)}\t${v.toFixed(decimales)}`)];
  return lineas.join("\r\n") + "\r\n";
}

// ── Lectura de la salida de SWMM ────────────────────────────────────────────

export interface SalidaSwmm {
  tH: number[];
  q: number[];
  errores: string[];
  avisos: string[];
}

const RE_HORA = /^(\d{1,3}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;
const RE_FECHA = /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/;

/**
 * Lee lo que se copia de una tabla de SWMM (o de un .txt, .csv o .rpt):
 * por línea, un tiempo y un caudal. El tiempo es la última hora "h:mm(:ss)"
 * de la línea (las columnas de días o fecha se ignoran y el cambio de día se
 * detecta solo), o, si no hay hora, el primer número en horas decimales. El
 * caudal es el último número de la línea. Las líneas sin números son
 * encabezados y se saltean.
 */
export function leerSalidaSwmm(texto: string): SalidaSwmm {
  const tH: number[] = [];
  const q: number[] = [];
  const errores: string[] = [];
  const avisos: string[] = [];
  let dias = 0;
  let relojPrevio = -1;
  texto.split(/\r?\n/).forEach((linea, i) => {
    const limpia = linea.replace(/;.*$/, "").trim();
    if (!limpia) return;
    const tokens = limpia.split(/[\s;\t]+|,(?=\s)/).filter(Boolean);
    let reloj: number | null = null;
    const numeros: number[] = [];
    for (const tok of tokens) {
      const h = RE_HORA.exec(tok);
      if (h) {
        reloj = Number(h[1]) + Number(h[2]) / 60 + (h[3] ? Number(h[3]) / 3600 : 0);
        continue;
      }
      if (RE_FECHA.test(tok)) continue;
      const n = numeroDeCelda(tok);
      if (n !== null && Number.isFinite(n)) numeros.push(n);
    }
    if (numeros.length === 0) return;
    let t: number;
    if (reloj !== null) {
      if (reloj < relojPrevio - 1e-9) dias++;
      relojPrevio = reloj;
      t = reloj + 24 * dias;
    } else if (numeros.length >= 2) {
      t = numeros[0];
    } else {
      errores.push(`Línea ${i + 1}: falta el tiempo (h:mm o horas) además del caudal.`);
      return;
    }
    const v = numeros[numeros.length - 1];
    if (v < 0) avisos.push(`Línea ${i + 1}: caudal negativo (${v}).`);
    if (tH.length > 0 && t <= tH[tH.length - 1]) {
      errores.push(`Línea ${i + 1}: el tiempo no avanza respecto a la línea anterior.`);
      return;
    }
    tH.push(t);
    q.push(v);
  });
  if (tH.length < 2 && errores.length === 0) errores.push("Se necesitan al menos dos puntos (tiempo y caudal).");
  return { tH, q, errores: errores.slice(0, 8), avisos: avisos.slice(0, 4) };
}

/** Interpola la salida de SWMM en la grilla de 1 minuto (0 antes y después). */
export function aGrillaMinuto(tH: readonly number[], q: readonly number[], minutos: number): number[] {
  const out = new Array<number>(minutos + 1).fill(0);
  let j = 0;
  for (let m = 0; m <= minutos; m++) {
    const t = m / 60;
    if (t < tH[0] - 1e-9 || t > tH[tH.length - 1] + 1e-9) continue;
    while (j < tH.length - 2 && tH[j + 1] < t) j++;
    const t0 = tH[j];
    const t1 = tH[j + 1] ?? t0;
    out[m] = t1 > t0 ? q[j] + ((q[j + 1] - q[j]) * (t - t0)) / (t1 - t0) : q[j];
  }
  return out;
}

/** Máximo almacenamiento implícito: máx. de ∫(entrada − salida) dt, en m³ (paso 1 min). */
export function almacenamientoMaximo(entrada: readonly number[], salida: readonly number[]): number {
  let s = 0;
  let max = 0;
  for (let i = 1; i < entrada.length; i++) {
    s += 30 * (entrada[i] + entrada[i - 1] - (salida[i] ?? 0) - (salida[i - 1] ?? 0));
    if (s < 0) s = 0;
    max = Math.max(max, s);
  }
  return max;
}

// ── Tabla de tormentas ──────────────────────────────────────────────────────

export const COLUMNAS_TORMENTAS: readonly EspecColumna[] = [
  { clave: "tr1", nombre: "tormenta_1_mm_h", alias: ["tr2", "tr_2", "p_tr2", "tr2_mm_h", "p_mm_h"], obligatoria: true, tipo: "numero" },
  { clave: "tr2", nombre: "tormenta_2_mm_h", alias: ["tr10", "tr_10", "p_tr10", "tr10_mm_h"], obligatoria: false, tipo: "numero" },
  { clave: "tr3", nombre: "tormenta_3_mm_h", alias: ["tr20", "tr_20", "p_tr20", "tr20_mm_h"], obligatoria: false, tipo: "numero" },
];

/** Columnas de la tabla → intensidades (mm/h); las columnas vacías quedan como null. */
export function validarTormentas(filas: readonly string[][]): { tormentas: (number[] | null)[]; errores: string[] } {
  const errores: string[] = [];
  const tormentas: (number[] | null)[] = [0, 1, 2].map((c) => {
    const vals = filas.map((f) => f[c] ?? "");
    if (vals.every((v) => v.trim() === "")) return null;
    const nums: number[] = [];
    vals.forEach((v, i) => {
      const n = numeroDeCelda(v);
      if (n === null) nums.push(0);
      else if (!Number.isFinite(n) || n < 0) {
        errores.push(`Fila ${i + 1}: "${v}" no es una intensidad válida.`);
        nums.push(0);
      } else nums.push(n);
    });
    while (nums.length > 0 && nums[nums.length - 1] === 0) nums.pop();
    return nums;
  });
  if (tormentas.every((t) => t === null)) errores.push("Cargá al menos una tormenta.");
  return { tormentas, errores: errores.slice(0, 8) };
}

/** Tormentas de 6 h a paso de 5 min (TR 2, 10 y 20 años), en mm/h, de la planilla de ejemplo. */
export const TORMENTAS_EJEMPLO: string[][] = [
  ["7,48104278", "12,33", "14,18411998"],
  ["7,982613592", "13,15621925", "15,13510245"],
  ["8,576474481", "14,13496687", "16,26106769"],
  ["9,82667326", "16,43374564", "18,86976968"],
  ["15,06055293", "24,8056166", "28,53911501"],
  ["16,3214649", "26,88241277", "30,9284902"],
  ["17,95185458", "29,56776048", "34,01801015"],
  ["20,17564786", "33,23047882", "38,23200497"],
  ["23,46942874", "38,65552969", "44,47358135"],
  ["29,11568446", "47,95524499", "55,1729987"],
  ["48,12166164", "79,2592074", "91,18852688"],
  ["113,3184203", "186,642104", "214,7336451"],
  ["48,12166164", "79,2592074", "91,18852688"],
  ["29,11568446", "47,95524499", "55,1729987"],
  ["23,46942874", "38,65552969", "44,47358135"],
  ["20,17564786", "33,23047882", "38,23200497"],
  ["17,95185458", "29,56776048", "34,01801015"],
  ["16,3214649", "26,88241277", "30,9284902"],
  ["15,06055293", "24,8056166", "28,53911501"],
  ["9,82667326", "16,43374564", "18,86976968"],
  ["8,576474481", "14,13496687", "16,26106769"],
  ["7,982613592", "13,15621925", "15,13510245"],
  ["7,48104278", "12,32957576", "14,18411998"],
  ["7,150721562", "11,78517031", "13,55782817"],
  ["6,950884661", "11,45581726", "13,17893573"],
  ["6,764302917", "11,14831016", "12,82517517"],
  ["6,589626833", "10,8604249", "12,49398785"],
  ["6,425688693", "10,59023693", "12,18315976"],
  ["6,271472514", "10,33607182", "11,89076459"],
  ["6,126089827", "10,09646527", "11,61511779"],
  ["5,988759988", "9,870130695", "11,35473926"],
  ["5,858794073", "9,655932669", "11,1083228"],
  ["5,735581589", "9,452865035", "10,87471089"],
  ["5,618579464", "9,260032751", "10,65287388"],
  ["5,507302848", "9,076636731", "10,44189248"],
  ["5,401317401", "8,901961137", "10,24094318"],
  ["5,300232788", "8,735362652", "10,04928591"],
  ["5,203697155", "8,576261382", "9,866253534"],
  ["5,111392433", "8,424133116", "9,691243005"],
  ["5,023030317", "8,278502697", "9,523707691"],
  ["4,938348812", "8,138938325", "9,363150846"],
  ["4,857109251", "8,005046655", "9,209119957"],
  ["4,77909372", "7,876468536", "9,061201853"],
  ["4,704102809", "7,752875323", "8,919018456"],
  ["4,631953667", "7,633965654", "8,782223076"],
  ["4,562478284", "7,519462634", "8,650497167"],
  ["4,495521999", "7,409111361", "8,523547487"],
  ["4,430942174", "7,302676755", "8,401103596"],
  ["4,368607033", "7,199941633", "8,282915646"],
  ["4,308394632", "7,100705018", "8,168752426"],
  ["4,25019194", "7,004780624", "8,058399634"],
  ["4,193894033", "6,911995523", "7,95165833"],
  ["4,139403364", "6,822188948", "7,848343563"],
  ["4,086629117", "6,735211224", "7,748283148"],
  ["4,035486629", "6,650922816", "7,65131656"],
  ["3,985896865", "6,569193467", "7,55729395"],
  ["3,937785955", "6,489901432", "7,466075261"],
  ["3,891084771", "6,41293278", "7,377529425"],
  ["3,845728546", "6,338180766", "7,291533641"],
  ["3,80165653", "6,265545268", "7,207972727"],
  ["3,758811677", "6,19493227", "7,126738526"],
  ["3,717140366", "6,126253398", "7,047729371"],
  ["3,676592142", "6,059425494", "6,970849597"],
  ["3,637119479", "5,994370234", "6,896009097"],
  ["3,598677573", "5,931013773", "6,823122919"],
  ["3,561224141", "5,869286426", "6,752110897"],
  ["3,524719247", "5,809122373", "6,682897313"],
  ["3,489125139", "5,750459394", "6,615410584"],
  ["3,454406095", "5,693238617", "6,549582985"],
  ["3,420528292", "5,637404296", "6,485350385"],
  ["3,387459674", "5,582903602", "6,422652009"],
  ["3,355169842", "5,529686431", "6,361430215"],
];
