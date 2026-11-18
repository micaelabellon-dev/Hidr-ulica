import { numeroDeCelda, type EspecColumna } from "@/lib/calculadoras/tablas";

/**
 * Amoníaco libre (NH₃, no ionizado) a partir del amonio total.
 *
 * Equilibrio NH₄⁺ ⇌ NH₃ + H⁺, con el pKa según temperatura de Emerson et al. (1975):
 *   pKa = 0,09018 + 2729,92 / (t + 273,16)          (t en °C)
 *   y   = pKa − pH
 *   F   = 1 / (1 + 10^y)                             fracción de NH₃ libre
 *
 * La fracción es molar: se aplica al amonio total en moles y después se
 * expresa en la unidad que se quiera. Por eso el resultado cambia según cómo
 * se reporte (masas molares NH₄⁺ 18, NH₃ 17, N 14 g/mol):
 *   NH₃ libre "como NH₄⁺" = F · C_NH4      (lo que da multiplicar F por el amonio en mg NH₄/L)
 *   NH₃ libre "como NH₃"  = F · C_NH4 · 17/18
 *   NH₃ libre "como N"    = F · C_NH4 · 14/18
 */

export type UnidadAmonio = "NH4" | "N" | "NH3";

export const MASA_MOLAR: Record<UnidadAmonio, number> = { NH4: 18, N: 14, NH3: 17 };

export const NOMBRE_UNIDAD: Record<UnidadAmonio, string> = {
  NH4: "mg NH₄⁺/L",
  N: "mg N/L",
  NH3: "mg NH₃/L",
};

export function pKaAmonio(temperaturaC: number): number {
  return 0.09018 + 2729.92 / (temperaturaC + 273.16);
}

export function fraccionLibre(pH: number, temperaturaC: number): number {
  return 1 / (1 + 10 ** (pKaAmonio(temperaturaC) - pH));
}

/** Convierte una concentración de nitrógeno amoniacal entre formas (misma cantidad de moles). */
export function convertirAmonio(valor: number, de: UnidadAmonio, a: UnidadAmonio): number {
  return (valor / MASA_MOLAR[de]) * MASA_MOLAR[a];
}

export interface ResultadoAmoniaco {
  pKa: number;
  y: number;
  fraccion: number;
  /** Amonio total en cada forma. */
  total: Record<UnidadAmonio, number>;
  /** NH₃ libre en cada forma. */
  libre: Record<UnidadAmonio, number>;
}

export function calcularAmoniaco(total: number, unidad: UnidadAmonio, pH: number, temperaturaC: number): ResultadoAmoniaco {
  const pKa = pKaAmonio(temperaturaC);
  const y = pKa - pH;
  const fraccion = 1 / (1 + 10 ** y);
  const formas: UnidadAmonio[] = ["NH4", "N", "NH3"];
  const totalEn = Object.fromEntries(formas.map((u) => [u, convertirAmonio(total, unidad, u)])) as Record<UnidadAmonio, number>;
  const libre = Object.fromEntries(formas.map((u) => [u, fraccion * totalEn[u]])) as Record<UnidadAmonio, number>;
  return { pKa, y, fraccion, total: totalEn, libre };
}

/**
 * Amonio total máximo para no superar un límite de NH₃ libre con ese pH y
 * temperatura: C_total = límite / F, en la unidad pedida.
 */
export function totalMaximoAdmisible(
  limite: number,
  unidadLimite: UnidadAmonio,
  unidadTotal: UnidadAmonio,
  pH: number,
  temperaturaC: number
): number {
  return convertirAmonio(limite / fraccionLibre(pH, temperaturaC), unidadLimite, unidadTotal);
}

// ── Varias muestras ────────────────────────────────────────────────────────

export const COLUMNAS_MUESTRAS: readonly EspecColumna[] = [
  { clave: "muestra", nombre: "muestra", alias: ["punto", "fecha", "id", "estacion", "sitio", "codigo"], obligatoria: false, tipo: "numero" },
  { clave: "amonio", nombre: "amonio", alias: ["nh4", "amonio_total", "nitrogeno_amoniacal", "n_amoniacal", "nh4_n", "nh3_n"], obligatoria: true, tipo: "numero" },
  { clave: "ph", nombre: "ph", alias: [], obligatoria: true, tipo: "numero" },
  { clave: "temperatura", nombre: "temperatura", alias: ["temp", "t", "temperatura_c"], obligatoria: true, tipo: "numero" },
];

export interface Muestra {
  etiqueta: string;
  total: number;
  pH: number;
  temperaturaC: number;
}

export function validarMuestras(filas: readonly string[][]): { muestras: Muestra[] | null; errores: string[] } {
  const errores: string[] = [];
  const muestras: Muestra[] = [];
  filas.forEach((f, i) => {
    if (!f.some((c) => (c ?? "").trim() !== "")) return;
    const n = i + 1;
    const leer = (j: number, nombre: string) => {
      const v = numeroDeCelda(f[j] ?? "");
      if (v === null) errores.push(`Fila ${n}: falta ${nombre}.`);
      else if (Number.isNaN(v)) errores.push(`Fila ${n}: ${nombre} «${f[j]}» no es un número.`);
      return v ?? NaN;
    };
    const total = leer(1, "el amonio");
    const pH = leer(2, "el pH");
    const t = leer(3, "la temperatura");
    if (total < 0) errores.push(`Fila ${n}: el amonio no puede ser negativo.`);
    if (pH < 0 || pH > 14) errores.push(`Fila ${n}: el pH va entre 0 y 14.`);
    if (t < 0 || t > 50) errores.push(`Fila ${n}: la ecuación de Emerson vale entre 0 y 50 °C.`);
    muestras.push({ etiqueta: (f[0] ?? "").trim() || String(n), total, pH, temperaturaC: t });
  });
  if (muestras.length === 0) errores.push("Cargá al menos una muestra.");
  return { muestras: errores.length ? null : muestras, errores: errores.slice(0, 15) };
}

export const MUESTRAS_EJEMPLO: string[][] = [
  ["Aguas arriba", "0,05", "7,3", "17"],
  ["Descarga", "2,4", "7,8", "22"],
  ["Aguas abajo 500 m", "0,9", "8,1", "24"],
  ["Aguas abajo 2 km", "0,35", "7,6", "21"],
];
