"use client";

import { useMemo } from "react";
import { NOMBRE_PARAMETRO, UNIDAD_PARAMETRO, type CalidadEfluente } from "@/lib/calc/tratamiento/comun";
import { aNumero, fmt } from "@/lib/calculadoras/formato";

export const PARAMETROS: (keyof CalidadEfluente)[] = ["dbo", "sst", "cf", "nt", "nh4", "pt", "ph"];

export type CalidadTexto = Record<keyof CalidadEfluente, string>;

export function leerCalidad(json: string, porDefecto: CalidadTexto): CalidadTexto {
  try {
    return { ...porDefecto, ...(JSON.parse(json) as Partial<CalidadTexto>) };
  } catch {
    return porDefecto;
  }
}

export function calidadANumeros(t: CalidadTexto, errores: string[]): CalidadEfluente {
  const out = {} as CalidadEfluente;
  for (const k of PARAMETROS) {
    const v = aNumero(t[k] ?? "");
    if (!Number.isFinite(v) || v < 0) errores.push(`${NOMBRE_PARAMETRO[k]} del afluente tiene que ser un número ≥ 0.`);
    out[k] = v;
  }
  return out;
}

/** Texto para guardar una calidad calculada como afluente de la etapa siguiente. */
export function calidadATexto(c: CalidadEfluente): string {
  return JSON.stringify(
    Object.fromEntries(PARAMETROS.map((k) => [k, String(+c[k].toPrecision(8)).replace(".", ",")]))
  );
}

/** Formato de una concentración: coliformes en notación científica, el resto con decimales. */
export function fmtParametro(k: keyof CalidadEfluente, v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (k === "cf") {
    if (v === 0) return "0";
    const e = Math.floor(Math.log10(v));
    return `${fmt(v / 10 ** e, 2)}×10${String(e).replace(/-/g, "⁻").replace(/\d/g, (x) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+x])}`;
  }
  return fmt(v, k === "ph" ? 1 : v < 10 ? 2 : 1);
}

/** Campos de calidad del afluente, en grilla compacta. */
export function CamposCalidad({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: CalidadTexto;
  onChange: (v: CalidadTexto) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {PARAMETROS.map((k) => (
        <label key={k} className="space-y-1 text-sm">
          <span className="block">
            {NOMBRE_PARAMETRO[k]} {UNIDAD_PARAMETRO[k] && <span className="text-muted-foreground">({UNIDAD_PARAMETRO[k]})</span>}
          </span>
          <input
            id={`${id}-${k}`}
            inputMode="decimal"
            value={valor[k] ?? ""}
            onChange={(e) => onChange({ ...valor, [k]: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      ))}
    </div>
  );
}

/** Tabla afluente → efluente(s), con el % de remoción de cada columna de salida. */
export function TablaCalidad({
  afluente,
  salidas,
  limites,
}: {
  afluente: CalidadEfluente;
  salidas: { titulo: string; calidad: CalidadEfluente }[];
  limites?: Partial<Record<keyof CalidadEfluente, number>>;
}) {
  const filas = useMemo(() => PARAMETROS.filter((k) => k !== "ph"), []);
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-[11px] text-muted-foreground">
          <tr>
            <th scope="col" className="px-2.5 py-1.5 text-left font-medium">
              Parámetro
            </th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
              Afluente
            </th>
            {salidas.map((s) => (
              <th key={s.titulo} scope="col" className="px-2.5 py-1.5 text-right font-medium">
                {s.titulo}
              </th>
            ))}
            {limites && (
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
                Objetivo
              </th>
            )}
          </tr>
        </thead>
        <tbody className="font-mono text-[13px] tabular-nums">
          {filas.map((k) => (
            <tr key={k} className="border-t border-border/40">
              <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                {NOMBRE_PARAMETRO[k]} <span className="text-[10px]">({UNIDAD_PARAMETRO[k]})</span>
              </th>
              <td className="px-2.5 py-1 text-right">{fmtParametro(k, afluente[k])}</td>
              {salidas.map((s) => {
                const rem = afluente[k] > 0 ? (1 - s.calidad[k] / afluente[k]) * 100 : NaN;
                const lim = limites?.[k];
                const noCumple = lim !== undefined && s.calidad[k] > lim;
                return (
                  <td key={s.titulo} className={`px-2.5 py-1 text-right ${noCumple ? "font-semibold text-destructive" : ""}`}>
                    {fmtParametro(k, s.calidad[k])}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{Number.isFinite(rem) ? `−${fmt(rem, 1)} %` : ""}</span>
                  </td>
                );
              })}
              {limites && <td className="px-2.5 py-1 text-right text-muted-foreground">{limites[k] !== undefined ? fmtParametro(k, limites[k]!) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
