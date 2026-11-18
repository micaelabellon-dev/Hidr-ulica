import { diasDelMes, fechaDeCelda, numeroDeCelda, type EspecColumna } from "@/lib/calculadoras/tablas";

/**
 * Balance hídrico de un embalse por continuidad, paso a paso:
 *
 *   V(t+1) = V(t) + Entradas − Salidas
 *   Entradas = Qaporte·Δt + P·A
 *   Salidas  = Qextracción·Δt + Qecológico·Δt + Qinfiltración·Δt + E·A
 *
 * Δt es la duración real del paso: los días de cada mes en paso mensual, o un
 * día en paso diario. A es el área del espejo de agua. Se toma en el volumen
 * medio del paso, (V(t) + V(t+1))/2, porque el área cambia durante el paso;
 * como V(t+1) depende de A, se resuelve por punto fijo (converge en 2 o 3
 * vueltas, porque P y E son chicos frente al volumen almacenado).
 *
 * Después de cerrar el balance:
 *   - si V(t+1) > Vmáx, el excedente vierte y V(t+1) = Vmáx;
 *   - si V(t+1) < Vmín, falta agua para cubrir las salidas: la diferencia es
 *     el déficit (demanda no atendida) y V(t+1) = Vmín.
 *
 * Unidades: caudales en m³/s, láminas en mm, áreas en ha, volúmenes en hm³.
 *   Q·Δt [m³]       → /10⁶ → hm³
 *   lámina·A [mm·ha] = 10 m³ por mm·ha → ×10⁻⁵ → hm³
 */

export type PasoTiempo = "mensual" | "diario";

export interface PuntoCurva {
  cotaM: number;
  areaHa: number;
  volumenHm3: number;
}

export interface RegistroSerie {
  /** ISO yyyy-mm-dd (día 01 en paso mensual). */
  fecha: string;
  aporteM3s: number;
  /** Lámina precipitada en el paso, en mm (del mes o del día). */
  precipitacionMm: number;
  /** Lámina evaporada en el paso, en mm (del mes o del día). */
  evaporacionMm: number;
  extraccionM3s: number;
}

export interface DatosBalance {
  paso: PasoTiempo;
  serie: RegistroSerie[];
  curva: PuntoCurva[];
  caudalEcologicoM3s: number;
  infiltracionM3s: number;
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
  /** Área del espejo en el volumen medio del paso. */
  areaHa: number;
  volumenMedioHm3: number;
  aporteHm3: number;
  precipitacionHm3: number;
  evaporacionHm3: number;
  extraccionHm3: number;
  ecologicoHm3: number;
  infiltracionHm3: number;
  entradasHm3: number;
  salidasHm3: number;
  deltaVHm3: number;
  /** V(t) + ΔV antes de aplicar los límites de vertedero y volumen muerto. */
  volumenSinLimitarHm3: number;
  vertidoHm3: number;
  deficitHm3: number;
  volumenFinalHm3: number;
  cotaFinalM: number;
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
  deficitTotalHm3: number;
  vertidoTotalHm3: number;
  entradasTotalesHm3: number;
  salidasTotalesHm3: number;
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

export function calcularBalance(datos: DatosBalance): ResultadoBalance {
  const { curva, volumenMinimoHm3: vMin, volumenMaximoHm3: vMax } = datos;
  const pasos: PasoBalance[] = [];
  let v = datos.volumenInicialHm3;

  datos.serie.forEach((reg, indice) => {
    const duracionS = duracionPasoS(reg.fecha, datos.paso);
    const aporteHm3 = caudalAVolumenHm3(reg.aporteM3s, duracionS);
    const extraccionHm3 = caudalAVolumenHm3(reg.extraccionM3s, duracionS);
    const ecologicoHm3 = caudalAVolumenHm3(datos.caudalEcologicoM3s, duracionS);
    const infiltracionHm3 = caudalAVolumenHm3(datos.infiltracionM3s, duracionS);

    let areaHa = areaDeVolumen(curva, v);
    let volumenMedioHm3 = v;
    let precipitacionHm3 = 0;
    let evaporacionHm3 = 0;
    let deltaVHm3 = 0;
    let iteraciones = 0;
    for (; iteraciones < 50; iteraciones++) {
      precipitacionHm3 = laminaAVolumenHm3(reg.precipitacionMm, areaHa);
      evaporacionHm3 = laminaAVolumenHm3(reg.evaporacionMm, areaHa);
      deltaVHm3 =
        aporteHm3 + precipitacionHm3 - extraccionHm3 - ecologicoHm3 - infiltracionHm3 - evaporacionHm3;
      const vFinAcotado = Math.min(vMax, Math.max(vMin, v + deltaVHm3));
      volumenMedioHm3 = (v + vFinAcotado) / 2;
      const nuevaArea = areaDeVolumen(curva, volumenMedioHm3);
      if (Math.abs(nuevaArea - areaHa) < 1e-9 * Math.max(1, areaHa)) {
        areaHa = nuevaArea;
        iteraciones++;
        break;
      }
      areaHa = nuevaArea;
    }
    precipitacionHm3 = laminaAVolumenHm3(reg.precipitacionMm, areaHa);
    evaporacionHm3 = laminaAVolumenHm3(reg.evaporacionMm, areaHa);
    const entradasHm3 = aporteHm3 + precipitacionHm3;
    const salidasHm3 = extraccionHm3 + ecologicoHm3 + infiltracionHm3 + evaporacionHm3;
    deltaVHm3 = entradasHm3 - salidasHm3;

    const volumenSinLimitarHm3 = v + deltaVHm3;
    const vertidoHm3 = Math.max(0, volumenSinLimitarHm3 - vMax);
    const deficitHm3 = Math.max(0, vMin - volumenSinLimitarHm3);
    const volumenFinalHm3 = Math.min(vMax, Math.max(vMin, volumenSinLimitarHm3));

    pasos.push({
      indice,
      fecha: reg.fecha,
      duracionS,
      volumenInicialHm3: v,
      cotaInicialM: cotaDeVolumen(curva, v),
      areaHa,
      volumenMedioHm3,
      aporteHm3,
      precipitacionHm3,
      evaporacionHm3,
      extraccionHm3,
      ecologicoHm3,
      infiltracionHm3,
      entradasHm3,
      salidasHm3,
      deltaVHm3,
      volumenSinLimitarHm3,
      vertidoHm3,
      deficitHm3,
      volumenFinalHm3,
      cotaFinalM: cotaDeVolumen(curva, volumenFinalHm3),
      iteraciones,
    });
    v = volumenFinalHm3;
  });

  let iMin = 0;
  let iMax = 0;
  pasos.forEach((p, i) => {
    if (p.volumenFinalHm3 < pasos[iMin].volumenFinalHm3) iMin = i;
    if (p.volumenFinalHm3 > pasos[iMax].volumenFinalHm3) iMax = i;
  });
  const suma = (f: (p: PasoBalance) => number) => pasos.reduce((s, p) => s + f(p), 0);
  // Umbral para no contar como vertido o déficit un residuo de redondeo.
  const UMBRAL = 1e-9;

  return {
    pasos,
    volumenMinimo: { valorHm3: pasos[iMin]?.volumenFinalHm3 ?? NaN, fecha: pasos[iMin]?.fecha ?? "" },
    volumenMaximo: { valorHm3: pasos[iMax]?.volumenFinalHm3 ?? NaN, fecha: pasos[iMax]?.fecha ?? "" },
    cotaMinimaM: pasos[iMin]?.cotaFinalM ?? NaN,
    cotaMaximaM: pasos[iMax]?.cotaFinalM ?? NaN,
    pasosConDeficit: pasos.filter((p) => p.deficitHm3 > UMBRAL).length,
    pasosConVertido: pasos.filter((p) => p.vertidoHm3 > UMBRAL).length,
    deficitTotalHm3: suma((p) => p.deficitHm3),
    vertidoTotalHm3: suma((p) => p.vertidoHm3),
    entradasTotalesHm3: suma((p) => p.entradasHm3),
    salidasTotalesHm3: suma((p) => p.salidasHm3),
  };
}

// ── Columnas y validación de las tablas de entrada ─────────────────────────

export const COLUMNAS_SERIE: readonly EspecColumna[] = [
  { clave: "fecha", nombre: "fecha", alias: ["fechas", "date", "mes", "dia", "periodo"], obligatoria: true, tipo: "fecha" },
  {
    clave: "aporteM3s",
    nombre: "aporte_m3s",
    alias: ["aporte", "aportes", "caudal", "caudal_medio", "q", "q_aporte", "afluente", "afluencia", "ingreso"],
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
    clave: "extraccionM3s",
    nombre: "extraccion_m3s",
    alias: ["extraccion", "extracciones", "demanda", "toma", "q_extraccion", "consumo"],
    obligatoria: true,
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
  aporteM3s: "aporte",
  precipitacionMm: "precipitación",
  evaporacionMm: "evaporación",
  extraccionM3s: "extracción",
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
  numeroFila: (i: number) => number = (i) => i + 1
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
      if (num === null) errores.push(`Fila ${n}: falta el valor de ${nombre}.`);
      else if (Number.isNaN(num)) errores.push(`Fila ${n}: ${nombre} «${texto}» no es un número.`);
      else if (num < 0) errores.push(`Fila ${n}: ${nombre} negativo (${texto}). Los valores tienen que ser ≥ 0.`);
      valores[col.clave] = num ?? NaN;
    });

    serie.push({
      fecha: fecha ? iso(fecha) : "",
      aporteM3s: valores.aporteM3s,
      precipitacionMm: valores.precipitacionMm,
      evaporacionMm: valores.evaporacionMm,
      extraccionM3s: valores.extraccionM3s,
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
