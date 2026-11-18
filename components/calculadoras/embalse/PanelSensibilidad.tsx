"use client";

import { useMemo } from "react";
import { botonArchivo, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import { demandaFirme, sensibilidadDemanda, type DatosBalance } from "@/lib/calc/hidraulica/balance-embalse";
import { useCampo } from "@/lib/hooks/useCampo";
import { aNumero, fmt } from "@/lib/calculadoras/formato";

interface PanelSensibilidadProps {
  datos: DatosBalance;
  /** Unidad de la demanda, p. ej. "m³/mes" o "m³/s". */
  unidad: string;
  /** Formatea un volumen en hm³ en la unidad de pantalla. */
  V: (hm3: number) => string;
  /** Usa una demanda como demanda constante de referencia. */
  onUsarDemanda: (demanda: number) => void;
  /** Demanda constante en uso (para marcarla), o null si viene de la serie. */
  demandaActual: number | null;
}

const MAX_ESCENARIOS = 40;

/** Sensibilidad a la demanda: escenarios de demanda constante y demanda firme para una garantía. */
export function PanelSensibilidad({ datos, unidad, V, onUsarDemanda, demandaActual }: PanelSensibilidadProps) {
  const [desdeTexto, setDesde] = useCampo("sensDesde", "0,5");
  const [hastaTexto, setHasta] = useCampo("sensHasta", "5");
  const [pasoTexto, setPaso] = useCampo("sensPaso", "0,5");
  const [garantiaTexto, setGarantia] = useCampo("sensGarantia", "95");
  const [criterio, setCriterio] = useCampo("sensCriterio", "Temporal (pasos cubiertos)");

  const desde = aNumero(desdeTexto);
  const hasta = aNumero(hastaTexto);
  const paso = aNumero(pasoTexto);
  const garantia = aNumero(garantiaTexto) / 100;
  const errores: string[] = [];
  if (![desde, hasta, paso].every(Number.isFinite) || desde < 0 || paso <= 0 || hasta < desde) {
    errores.push("Revisá el rango de demandas: desde ≥ 0, hasta ≥ desde y paso > 0.");
  } else if ((hasta - desde) / paso + 1 > MAX_ESCENARIOS) {
    errores.push(`Son demasiados escenarios: como máximo ${MAX_ESCENARIOS}. Agrandá el paso.`);
  }
  if (!(garantia > 0 && garantia <= 1)) errores.push("La garantía objetivo va entre 0 y 100 %.");
  const crit = criterio.startsWith("Volum") ? "volumetrica" : "temporal";

  const demandas = useMemo(() => {
    if (errores.length) return [];
    const out: number[] = [];
    for (let d = desde; d <= hasta + paso * 1e-9; d += paso) out.push(+d.toPrecision(12));
    return out;
  }, [desde, hasta, paso, errores.length]);

  const escenarios = errores.length ? [] : sensibilidadDemanda(datos, demandas);
  const firme = errores.length ? NaN : demandaFirme(datos, garantia, crit);
  const pct = (x: number) => `${fmt(x * 100, 1)} %`;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Sensibilidad a la demanda</p>
      <p className="-mt-2 text-xs text-muted-foreground">
        Corre el mismo balance con una demanda constante en cada paso, para cada valor del rango, y busca la mayor demanda que
        cumple la garantía pedida. Demanda en {unidad}.
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <CampoNumerico id="sensDesde" etiqueta="Desde" sufijo={unidad} valor={desdeTexto} onChange={setDesde} />
        <CampoNumerico id="sensHasta" etiqueta="Hasta" sufijo={unidad} valor={hastaTexto} onChange={setHasta} />
        <CampoNumerico id="sensPaso" etiqueta="Paso" sufijo={unidad} valor={pasoTexto} onChange={setPaso} />
        <CampoNumerico id="sensGarantia" etiqueta="Garantía objetivo" sufijo="%" valor={garantiaTexto} onChange={setGarantia} />
        <CampoSeleccion
          id="sensCriterio"
          etiqueta="Criterio"
          valor={crit === "volumetrica" ? "Volumétrica" : "Temporal (pasos cubiertos)"}
          opciones={["Temporal (pasos cubiertos)", "Volumétrica"]}
          onChange={setCriterio}
        />
      </div>
      <ListaErrores titulo="Revisá el rango" errores={errores} />
      {escenarios.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-accent/60 px-3 py-2">
            <p className="text-sm">
              Demanda firme con garantía {crit === "temporal" ? "temporal" : "volumétrica"} ≥ {fmt(garantia * 100, 1)} %:{" "}
              <span className="font-mono font-semibold tabular-nums">
                {fmt(firme, firme >= 100 ? 0 : 3)} {unidad}
              </span>
            </p>
            <button type="button" className={`${botonArchivo} print:hidden`} onClick={() => onUsarDemanda(firme)}>
              Usar como demanda constante
            </button>
          </div>
          <GraficoLineas
            titulo="Garantía según la demanda"
            series={[
              { id: "gt", nombre: "Garantía temporal", color: "var(--serie-1)", puntos: escenarios.map((e) => ({ x: e.demanda, y: e.garantiaTemporal * 100 })) },
              {
                id: "gv",
                nombre: "Garantía volumétrica",
                color: "var(--serie-2)",
                discontinua: true,
                puntos: escenarios.map((e) => ({ x: e.demanda, y: e.garantiaVolumetrica * 100 })),
              },
            ]}
            referenciasY={[{ y: garantia * 100, etiqueta: `objetivo ${fmt(garantia * 100, 0)} %` }]}
            formatoX={(x) => fmt(x, x >= 100 ? 0 : 2)}
            formatoY={(y) => `${fmt(y, 0)} %`}
            formatoXTooltip={(x) => `Demanda ${fmt(x, x >= 100 ? 0 : 3)} ${unidad}`}
            formatoValor={(y) => `${fmt(y, 2)} %`}
            ejeX={`Demanda (${unidad})`}
            ejeY="Garantía (%)"
            alto={220}
          />
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
              <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                <tr>
                  {[`Demanda (${unidad})`, "Garantía temporal", "Garantía volumétrica", "Pasos con falla", "Racha máx.", "Déficit máx.", "Cumple Qamb", "Volumen mín."].map(
                    (t) => (
                      <th key={t} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {t}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {escenarios.map((e) => (
                  <tr
                    key={e.demanda}
                    className={`border-t border-border/40 ${demandaActual !== null && Math.abs(e.demanda - demandaActual) < 1e-9 ? "bg-accent/60" : ""}`}
                  >
                    <td className="px-2 py-1">{fmt(e.demanda, e.demanda >= 100 ? 0 : 3)}</td>
                    <td className={`px-2 py-1 ${e.garantiaTemporal < garantia ? "text-destructive" : ""}`}>{pct(e.garantiaTemporal)}</td>
                    <td className={`px-2 py-1 ${e.garantiaVolumetrica < garantia ? "text-destructive" : ""}`}>{pct(e.garantiaVolumetrica)}</td>
                    <td className="px-2 py-1">{e.pasosConFalla}</td>
                    <td className="px-2 py-1">{e.rachaMaximaFalla}</td>
                    <td className="px-2 py-1">{V(e.deficitMaximoHm3)}</td>
                    <td className="px-2 py-1">{pct(e.cumplimientoQamb)}</td>
                    <td className="px-2 py-1">{V(e.volumenMinimoHm3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
