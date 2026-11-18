import { numeroDeCelda } from "@/lib/calculadoras/tablas";

/**
 * Cumplimiento de calidad de aire a partir de una serie de concentraciones
 * horarias: promedio de cada día (sólo con datos), máximo diario y promedio
 * del período (como estimador del anual), contra los estándares.
 */

export interface Medicion {
  dia: string;
  valor: number;
}

export interface ResultadoCumplimiento {
  diarios: { dia: string; promedio: number; horas: number; supera: boolean }[];
  maximoDiario: { dia: string; valor: number };
  promedioPeriodo: number;
  diasQueSuperan: number;
  cumpleDiario: boolean | null;
  cumpleAnual: boolean | null;
  percentil: number | null;
}

export function evaluarCumplimiento(
  mediciones: readonly Medicion[],
  limiteDiario: number | null,
  limiteAnual: number | null,
  fondo = 0,
  minHorasPorDia = 1
): ResultadoCumplimiento {
  const porDia = new Map<string, number[]>();
  for (const m of mediciones) porDia.set(m.dia, [...(porDia.get(m.dia) ?? []), m.valor]);
  const diarios = [...porDia]
    .filter(([, v]) => v.length >= minHorasPorDia)
    .map(([dia, v]) => {
      const promedio = v.reduce((s, x) => s + x, 0) / v.length + fondo;
      return { dia, promedio, horas: v.length, supera: limiteDiario !== null && promedio > limiteDiario };
    });
  const maximoDiario = diarios.reduce((a, b) => (b.promedio > a.valor ? { dia: b.dia, valor: b.promedio } : a), {
    dia: "",
    valor: -Infinity,
  });
  const promedioPeriodo = diarios.reduce((s, d) => s + d.promedio, 0) / (diarios.length || 1);
  const ordenados = diarios.map((d) => d.promedio).sort((a, b) => a - b);
  const percentil = ordenados.length ? ordenados[Math.min(ordenados.length - 1, Math.ceil(0.98 * ordenados.length) - 1)] : null;
  return {
    diarios,
    maximoDiario,
    promedioPeriodo,
    diasQueSuperan: diarios.filter((d) => d.supera).length,
    cumpleDiario: limiteDiario === null ? null : maximoDiario.valor <= limiteDiario,
    cumpleAnual: limiteAnual === null ? null : promedioPeriodo <= limiteAnual,
    percentil,
  };
}

export function validarMediciones(filas: readonly string[][]): { mediciones: Medicion[] | null; errores: string[] } {
  const errores: string[] = [];
  const out: Medicion[] = [];
  filas.forEach((f, i) => {
    if (!f.some((c) => (c ?? "").trim() !== "")) return;
    const dia = (f[0] ?? "").trim();
    const v = numeroDeCelda(f[2] ?? "");
    if (!dia) errores.push(`Fila ${i + 1}: falta el día.`);
    if (v === null) errores.push(`Fila ${i + 1}: falta la concentración.`);
    else if (Number.isNaN(v) || v < 0) errores.push(`Fila ${i + 1}: la concentración «${f[2]}» no es válida.`);
    out.push({ dia, valor: v ?? NaN });
  });
  if (out.length === 0) errores.push("Cargá al menos una medición.");
  return { mediciones: errores.length ? null : out, errores: errores.slice(0, 15) };
}
