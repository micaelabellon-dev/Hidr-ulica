"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { botonArchivo } from "@/components/calculadoras/comun/BarraArchivos";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import { cuatrimestreDeMes, CUATRIMESTRES } from "@/lib/calc/hidraulica/balance-embalse";
import type { PasoTemez } from "@/lib/calc/hidraulica/temez";
import { descargarCsv, descargarXlsx, type TablaSalida } from "@/lib/calculadoras/tablas";
import { fmt } from "@/lib/calculadoras/formato";

interface PanelTemezProps {
  pasos: PasoTemez[];
  areaEscurreM2: number;
  /** q medio de la regionalización: anual y por cuatrimestre (ABR-JUL, AGO-NOV, DIC-MAR), L/s/km². */
  qRegional: { anual: number; cuatrimestres: readonly number[] } | null;
  anioHasta: number | null;
  fechaCorta: (iso: string) => string;
}

function tabla(pasos: PasoTemez[], areaEscurreM2: number): TablaSalida {
  return {
    hoja: "Temez",
    encabezados: [
      "fecha", "dias", "P_mm", "ETP_mm", "delta_mm", "P0_mm", "T_excedente_mm", "H_humedad_mm", "ETR_mm",
      "I_infiltracion_mm", "Asup_mm", "V_subterraneo_mm", "Asub_mm", "aporte_mm", "aporte_m3", "q_L_s_km2",
    ],
    filas: pasos.map((p) => {
      const [a, m] = p.fecha.split("-").map(Number);
      return [
        new Date(Date.UTC(a, m - 1, 1)), p.dias, p.precipitacionMm, p.etpMm, p.delta, p.p0, p.excedente, p.humedad, p.etr,
        p.infiltracion, p.escorrentiaSuperficial, p.almacenamiento, p.escorrentiaSubterranea, p.aporteMm,
        (p.aporteMm / 1000) * areaEscurreM2, p.caudalEspecificoLsKm2,
      ];
    }),
    formatos: ["yyyy-mm", "0", ...Array(12).fill("0.00"), "0", "0.000"],
  };
}

/** Resultados del modelo de Témez: resumen, comparación con la regionalización, gráfico y tabla. */
export function PanelTemez({ pasos, areaEscurreM2, qRegional, anioHasta, fechaCorta }: PanelTemezProps) {
  const n = pasos.length;
  const pAnual = (pasos.reduce((s, p) => s + p.precipitacionMm, 0) / n) * 12;
  const aAnual = (pasos.reduce((s, p) => s + p.aporteMm, 0) / n) * 12;
  const qMedio = aAnual / 31.536;
  const periodo = anioHasta ? pasos.filter((p) => Number(p.fecha.slice(0, 4)) <= anioHasta) : pasos;
  const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
  const qPeriodo = media(periodo.map((p) => p.caudalEspecificoLsKm2));
  const qCuatri = [0, 1, 2].map((c) =>
    media(periodo.filter((p) => cuatrimestreDeMes(Number(p.fecha.slice(5, 7)) - 1) === c).map((p) => p.caudalEspecificoLsKm2))
  );

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Modelo de Témez</p>
      <PanelMetricas
        horizontal
        metricas={[
          { etiqueta: "Precipitación media", valor: `${fmt(pAnual, 0)} mm/año` },
          { etiqueta: "Aporte medio", valor: `${fmt(aAnual, 0)} mm/año`, nota: `${fmt((aAnual / 1000) * areaEscurreM2 / 1e6, 2)} hm³/año` },
          { etiqueta: "Coef. de escorrentía", valor: fmt(aAnual / pAnual, 3), destacada: true },
          { etiqueta: "q medio", valor: `${fmt(qMedio, 2)} L/s/km²` },
        ]}
      />
      {qRegional && (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full border-collapse text-sm">
            <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left text-xs font-medium">
              Validación contra la regionalización (q medio, L/s/km²){anioHasta ? `, meses hasta ${anioHasta}` : ""}
            </caption>
            <thead className="text-[11px] text-muted-foreground">
              <tr>
                <th scope="col" />
                <th scope="col" className="px-2.5 py-1 text-right font-medium">Témez</th>
                <th scope="col" className="px-2.5 py-1 text-right font-medium">Regionalización</th>
                <th scope="col" className="px-2.5 py-1 text-right font-medium">Témez / Reg.</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px] tabular-nums">
              {[...CUATRIMESTRES.map((c, i) => [c, qCuatri[i], qRegional.cuatrimestres[i]] as const), ["Anual", qPeriodo, qRegional.anual] as const].map(
                ([e, t, r]) => (
                  <tr key={e} className="border-t border-border/40">
                    <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                      {e}
                    </th>
                    <td className="px-2.5 py-1 text-right">{fmt(t, 2)}</td>
                    <td className="px-2.5 py-1 text-right">{fmt(r, 2)}</td>
                    <td className="px-2.5 py-1 text-right">{fmt(t / r, 2)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
      <GraficoLineas
        titulo="Caudal específico mensual de la cuenca (Témez)"
        series={[{ id: "q", nombre: "q", color: "var(--serie-1)", puntos: pasos.map((p, i) => ({ x: i, y: p.caudalEspecificoLsKm2 })) }]}
        formatoX={(i) => fechaCorta(pasos[Math.round(i)]?.fecha ?? "")}
        formatoY={(y) => fmt(y, 0)}
        formatoValor={(y) => `${fmt(y, 2)} L/s/km²`}
        extraTooltip={(i) => {
          const p = pasos[Math.round(i)];
          return p ? [{ etiqueta: "P (mm)", valor: fmt(p.precipitacionMm, 1) }, { etiqueta: "aporte (mm)", valor: fmt(p.aporteMm, 1) }] : [];
        }}
        ticksX={Array.from({ length: 7 }, (_, k) => Math.round((k * (n - 1)) / 6))}
        ejeX="Mes"
        ejeY="q (L/s/km²)"
        desdeCero
        alto={200}
      />
      <div className="flex flex-wrap items-center justify-end gap-1.5 print:hidden">
        <button type="button" className={botonArchivo} onClick={() => descargarXlsx([tabla(pasos, areaEscurreM2)], "temez.xlsx")}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar Témez .xlsx
        </button>
        <button type="button" className={botonArchivo} onClick={() => descargarCsv(tabla(pasos, areaEscurreM2), "temez.csv")}>
          <Download className="h-3.5 w-3.5" />
          .csv
        </button>
      </div>
    </div>
  );
}
