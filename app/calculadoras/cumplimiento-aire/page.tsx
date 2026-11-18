"use client";

import { useMemo } from "react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import { evaluarCumplimiento, validarMediciones } from "@/lib/calc/aire/cumplimiento";
import type { EspecColumna } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("cumplimiento-aire");

const COLUMNAS: EspecColumna[] = [
  { clave: "dia", nombre: "dia", alias: ["fecha", "day"], obligatoria: true, tipo: "numero" },
  { clave: "hora", nombre: "hora", alias: ["h", "hour"], obligatoria: false, tipo: "numero" },
  { clave: "valor", nombre: "concentracion", alias: ["pm10", "pm2_5", "pm25", "valor", "c", "no2", "so2", "co", "o3"], obligatoria: true, tipo: "numero" },
];

/** Tres días de ejemplo (valores de la planilla). */
const EJEMPLO: string[][] = [
  ...[21.7, 38.5, 22.9, 19.1, 21.1, 26.3, 19.5, 18.4, 25.2, 49.3, 17.2, 32.5, 23.3, 19.2, 25.2, 49.7, 21.2, 68.7, 19.5, 33.5, 31.1, 17.5, 60.9, 55.9].map((v, h) => ["1", String(h), String(v).replace(".", ",")]),
  ...[32.7, 22.1, 36.4, 23.7, 26, 21.6, 23.1, 51.5, 16.5, 19.2, 9.7, 16.8, 25.6, 24.3, 58.4, 63.6, 26, 30.7, 51.8, 52, 37.5, 17.1, 36.9, 50.9].map((v, h) => ["2", String(h), String(v).replace(".", ",")]),
];

export default function CumplimientoAirePage() {
  const [filas, setFilas] = useTabla("mediciones", EJEMPLO);
  const [diarioTexto, setDiario] = useCampo("limiteDiario", "50");
  const [anualTexto, setAnual] = useCampo("limiteAnual", "20");
  const [fondoTexto, setFondo] = useCampo("fondo", "0");
  const [minHorasTexto, setMinHoras] = useCampo("minHoras", "18");

  const v = useMemo(() => validarMediciones(filas), [filas]);
  const opt = (t: string) => (t.trim() === "" ? null : aNumero(t));
  const r = v.mediciones
    ? evaluarCumplimiento(v.mediciones, opt(diarioTexto), opt(anualTexto), aNumero(fondoTexto) || 0, Math.max(1, Math.round(aNumero(minHorasTexto) || 1)))
    : null;
  const limD = opt(diarioTexto);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={[]} metodo="" onMetodoChange={() => {}} />
      </div>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Estándares</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="limiteDiario" etiqueta="Límite promedio diario" sufijo="µg/m³" valor={diarioTexto} onChange={setDiario} />
              <CampoNumerico id="limiteAnual" etiqueta="Límite promedio anual" sufijo="µg/m³" valor={anualTexto} onChange={setAnual} />
              <CampoNumerico id="fondo" etiqueta="Concentración de fondo" sufijo="µg/m³" valor={fondoTexto} onChange={setFondo} advertencia="Se suma a cada promedio diario." />
              <CampoNumerico id="minHoras" etiqueta="Horas mínimas por día" valor={minHorasTexto} onChange={setMinHoras} advertencia="Días con menos datos no se cuentan (75 % = 18 h)." />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Por defecto, los valores de PM10 de tu planilla (Decreto 135/021). Revisá el contaminante y el decreto vigente.</p>
          </div>
          <div className="space-y-3">
            <p className="spec-label">Mediciones horarias</p>
            <BarraArchivos id="med" especs={COLUMNAS} onImportar={setFilas} />
            <TablaEditable
              id="tabla-med"
              columnas={[{ titulo: "Día", texto: true }, { titulo: "Hora", texto: true }, { titulo: "Concentración", sufijo: "µg/m³" }]}
              filas={filas}
              onChange={setFilas}
              filasConError={filasDeErrores(v.errores)}
              porPagina={24}
              filaNueva={() => ["", "", ""]}
            />
            <ListaErrores titulo="Errores" errores={v.errores} />
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Máximo diario", valor: `${fmt(r.maximoDiario.valor, 1)} µg/m³`, nota: `día ${r.maximoDiario.dia}`, destacada: true },
                  { etiqueta: "Norma diaria", valor: r.cumpleDiario === null ? "—" : r.cumpleDiario ? "Cumple" : "No cumple", nota: `${r.diasQueSuperan} días superan` },
                  { etiqueta: "Promedio del período", valor: `${fmt(r.promedioPeriodo, 1)} µg/m³`, nota: `${r.diarios.length} días` },
                  { etiqueta: "Norma anual", valor: r.cumpleAnual === null ? "—" : r.cumpleAnual ? "Cumple" : "No cumple", nota: "con el promedio del período" },
                ]}
              />
              <GraficoLineas
                titulo="Promedios diarios"
                series={[{ id: "d", nombre: "Promedio diario", color: "var(--serie-1)", soloMarcadores: r.diarios.length < 3, puntos: r.diarios.map((d, i) => ({ x: i + 1, y: d.promedio })) }]}
                referenciasY={[...(limD !== null ? [{ y: limD, etiqueta: "límite diario" }] : []), ...(opt(anualTexto) !== null ? [{ y: opt(anualTexto)!, etiqueta: "límite anual" }] : [])]}
                formatoX={(i) => r.diarios[Math.round(i) - 1]?.dia ?? ""}
                formatoY={(y) => fmt(y, 0)}
                formatoXTooltip={(i) => `Día ${r.diarios[Math.round(i) - 1]?.dia ?? ""}`}
                formatoValor={(y) => `${fmt(y, 1)} µg/m³`}
                ejeX="Día"
                ejeY="µg/m³"
                desdeCero
                alto={220}
              />
              <div className="max-h-80 overflow-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="sticky top-0 bg-muted font-sans text-[11px] text-muted-foreground">
                    <tr>
                      {["Día", "Horas", "Promedio", ""].map((h) => (
                        <th key={h} className="px-2 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.diarios.map((d) => (
                      <tr key={d.dia} className="border-t border-border/40">
                        <td className="px-2 py-1">{d.dia}</td>
                        <td className="px-2 py-1">{d.horas}</td>
                        <td className={`px-2 py-1 ${d.supera ? "font-semibold text-destructive" : ""}`}>{fmt(d.promedio, 2)}</td>
                        <td className="px-2 py-1 font-sans text-[11px]">{d.supera ? "supera" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
