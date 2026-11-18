"use client";

import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import {
  calcularAmoniaco,
  COLUMNAS_MUESTRAS,
  fraccionLibre,
  MUESTRAS_EJEMPLO,
  NOMBRE_UNIDAD,
  totalMaximoAdmisible,
  validarMuestras,
  type UnidadAmonio,
} from "@/lib/calc/calidad/amoniaco";
import { descargarCsv, descargarXlsx, numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("amoniaco-libre");

const UNIDADES: Record<string, UnidadAmonio> = {
  "mg NH₄⁺/L (amonio)": "NH4",
  "mg NH₄–N/L (nitrógeno amoniacal)": "N",
  "mg NH₃/L": "NH3",
};
const ETIQUETA_UNIDAD: Record<UnidadAmonio, string> = {
  NH4: "mg NH₄⁺/L (amonio)",
  N: "mg NH₄–N/L (nitrógeno amoniacal)",
  NH3: "mg NH₃/L",
};
const FORMAS: UnidadAmonio[] = ["NH4", "NH3", "N"];
const NOMBRE_FORMA: Record<UnidadAmonio, string> = { NH4: "como NH₄⁺", NH3: "como NH₃", N: "como N" };

/** Muestra concentraciones chicas con cifras significativas, no con decimales fijos. */
function conc(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  const d = Math.max(2, Math.min(8, 3 - Math.floor(Math.log10(Math.abs(x)))));
  return fmt(x, d);
}

const TEMPERATURAS_CURVA = [10, 20, 30];
const COLOR_T = ["var(--serie-1)", "var(--serie-3)", "var(--serie-2)"];

export default function AmoniacoLibrePage() {
  const [modo, setModo] = useCampo("modo", "Una muestra");
  const [totalTexto, setTotal] = useCampo("total", "0,05");
  const [unidadNombre, setUnidadNombre] = useCampo("unidad", "mg NH₄⁺/L (amonio)");
  const [phTexto, setPh] = useCampo("ph", "7,3");
  const [tTexto, setT] = useCampo("t", "17");
  const [limiteTexto, setLimite] = useCampo("limite", "");
  const [unidadLimiteNombre, setUnidadLimiteNombre] = useCampo("unidadLimite", "mg NH₃/L");
  const [muestras, setMuestras] = useTabla("muestras", MUESTRAS_EJEMPLO);

  const unidad = UNIDADES[unidadNombre] ?? "NH4";
  const unidadLimite = UNIDADES[unidadLimiteNombre] ?? "NH3";
  const varias = modo === "Varias muestras";

  const errores: string[] = [];
  const total = aNumero(totalTexto);
  const pH = aNumero(phTexto);
  const t = aNumero(tTexto);
  if (!varias) {
    if (!Number.isFinite(total) || total < 0) errores.push("El amonio tiene que ser un número ≥ 0.");
    if (!Number.isFinite(pH) || pH < 0 || pH > 14) errores.push("El pH va entre 0 y 14.");
    if (!Number.isFinite(t) || t < 0 || t > 50) errores.push("La temperatura va entre 0 y 50 °C (rango de la ecuación de Emerson).");
  }
  const limite = limiteTexto.trim() === "" ? null : aNumero(limiteTexto);
  if (limite !== null && !(limite > 0)) errores.push("El límite tiene que ser un número mayor que cero, o dejarlo vacío.");

  const r = !varias && errores.length === 0 ? calcularAmoniaco(total, unidad, pH, t) : null;
  const libreEnLimite = r && limite !== null ? r.libre[unidadLimite] : null;
  const maximo = !varias && limite !== null && errores.length === 0 ? totalMaximoAdmisible(limite, unidadLimite, unidad, pH, t) : null;

  const validacionMuestras = useMemo(() => validarMuestras(muestras), [muestras]);
  const resultadosMuestras =
    varias && validacionMuestras.muestras
      ? validacionMuestras.muestras.map((m) => ({ m, r: calcularAmoniaco(m.total, unidad, m.pH, m.temperaturaC) }))
      : null;

  const avisos: string[] = [];
  if (r && pH > 9) avisos.push("Con pH mayor a 9 casi todo el amonio está como NH₃ libre: revisá la medición de pH y la temperatura.");

  const tablaSalida = (): TablaSalida => ({
    hoja: "Amoníaco libre",
    encabezados: [
      "muestra",
      `amonio_${unidad}`,
      "ph",
      "temperatura_c",
      "fraccion_libre",
      "nh3_libre_como_nh4_mg_l",
      "nh3_libre_como_nh3_mg_l",
      "nh3_libre_como_n_mg_l",
      ...(limite !== null ? [`cumple_limite_${limiteTexto}_${unidadLimite}`] : []),
    ],
    filas: (resultadosMuestras ?? []).map(({ m, r }) => [
      m.etiqueta,
      m.total,
      m.pH,
      m.temperaturaC,
      r.fraccion,
      r.libre.NH4,
      r.libre.NH3,
      r.libre.N,
      ...(limite !== null ? [r.libre[unidadLimite] <= limite ? "sí" : "no"] : []),
    ]),
  });

  // Curvas: % de NH₃ libre según pH, para 10, 20 y 30 °C (y la temperatura de la muestra).
  const phs = Array.from({ length: 61 }, (_, i) => 6 + i * 0.075);
  const temps = [...new Set([...TEMPERATURAS_CURVA, ...(r ? [t] : [])])].sort((a, b) => a - b);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-4xl font-medium">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={[]} metodo="" onMetodoChange={() => {}} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Muestra</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion id="modo" etiqueta="Calcular" valor={varias ? "Varias muestras" : "Una muestra"} opciones={["Una muestra", "Varias muestras"]} onChange={setModo} />
              <CampoSeleccion
                id="unidad"
                etiqueta="El amonio total viene en"
                valor={ETIQUETA_UNIDAD[unidad]}
                opciones={Object.keys(UNIDADES)}
                onChange={setUnidadNombre}
              />
            </div>
            {!varias ? (
              <div className="grid grid-cols-3 gap-3">
                <CampoNumerico id="total" etiqueta="Amonio total" sufijo="mg/L" valor={totalTexto} onChange={setTotal} />
                <CampoNumerico id="ph" etiqueta="pH" valor={phTexto} onChange={setPh} />
                <CampoNumerico id="t" etiqueta="Temperatura" sufijo="°C" valor={tTexto} onChange={setT} />
              </div>
            ) : (
              <>
                <BarraArchivos
                  id="muestras"
                  especs={COLUMNAS_MUESTRAS}
                  onImportar={setMuestras}
                  plantilla={() => [
                    {
                      hoja: "Muestras",
                      encabezados: ["muestra", "amonio", "ph", "temperatura"],
                      filas: MUESTRAS_EJEMPLO.map(([e, ...v]) => [e, ...v.map((x) => numeroDeCelda(x))]),
                    },
                  ]}
                  nombrePlantilla="plantilla-amonio"
                />
                <TablaEditable
                  id="tabla-muestras"
                  columnas={[
                    { titulo: "Muestra / punto", texto: true },
                    { titulo: "Amonio", sufijo: NOMBRE_UNIDAD[unidad] },
                    { titulo: "pH" },
                    { titulo: "Temp.", sufijo: "°C" },
                  ]}
                  filas={muestras}
                  onChange={setMuestras}
                  filasConError={filasDeErrores(validacionMuestras.errores)}
                  filaNueva={() => ["", "", "", ""]}
                />
                <ListaErrores titulo="Errores en las muestras" errores={validacionMuestras.errores} />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Elegí la unidad en que viene el dato del laboratorio y la calculadora convierte sola: NH₄–N a NH₄⁺ es ÷ 14 × 18.
            </p>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Límite (opcional)</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="limite" etiqueta="Límite de NH₃ libre" sufijo="mg/L" valor={limiteTexto} onChange={setLimite} advertencia="Vacío para no comparar." />
              <CampoSeleccion
                id="unidadLimite"
                etiqueta="El límite está expresado"
                valor={ETIQUETA_UNIDAD[unidadLimite]}
                opciones={Object.keys(UNIDADES)}
                onChange={setUnidadLimiteNombre}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Fijate cómo expresa la norma el límite de amoníaco libre (como NH₃ o como N): con el mismo dato, el resultado como NH₃ es
              17/18 del valor como NH₄⁺, y como N, 14/18.
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          <ListaAvisos avisos={avisos} />
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Fracción libre F", valor: `${fmt(r.fraccion * 100, r.fraccion < 0.01 ? 3 : 2)} %`, nota: `pKa ${fmt(r.pKa, 3)}` },
                  { etiqueta: "NH₃ libre como NH₃", valor: `${conc(r.libre.NH3)}`, nota: "mg NH₃/L", destacada: true },
                  { etiqueta: "NH₃ libre como N", valor: `${conc(r.libre.N)}`, nota: "mg N/L" },
                  libreEnLimite !== null && limite !== null
                    ? {
                        etiqueta: "Frente al límite",
                        valor: libreEnLimite <= limite ? "Cumple" : "No cumple",
                        nota: `${conc(libreEnLimite)} ${libreEnLimite <= limite ? "≤" : ">"} ${conc(limite)} ${NOMBRE_UNIDAD[unidadLimite]}`,
                      }
                    : { etiqueta: "Como en la planilla", valor: conc(r.libre.NH4), nota: "F × amonio (mg NH₄⁺/L)" },
                ]}
              />
              {maximo !== null && (
                <p className="rounded-lg border border-primary/40 bg-accent/60 px-3 py-2 text-sm">
                  Con pH {fmt(pH, 2)} y {fmt(t, 1)} °C, el amonio total máximo para no superar {conc(limite!)} {NOMBRE_UNIDAD[unidadLimite]} de NH₃
                  libre es <span className="font-mono font-semibold tabular-nums">{conc(maximo)} {NOMBRE_UNIDAD[unidad]}</span>.
                </p>
              )}

              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                    <tr>
                      <th scope="col" />
                      {FORMAS.map((u) => (
                        <th key={u} scope="col" className="px-2.5 py-1.5 text-right font-medium">
                          {NOMBRE_FORMA[u]} ({NOMBRE_UNIDAD[u]})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] tabular-nums">
                    {(
                      [
                        ["Amonio total", r.total],
                        ["NH₃ libre", r.libre],
                        ["NH₄⁺ ionizado", Object.fromEntries(FORMAS.map((u) => [u, r.total[u] - r.libre[u]])) as Record<UnidadAmonio, number>],
                      ] as const
                    ).map(([e, v]) => (
                      <tr key={e} className="border-t border-border/40">
                        <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                          {e}
                        </th>
                        {FORMAS.map((u) => (
                          <td key={u} className="px-2.5 py-1 text-right">
                            {conc(v[u])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  ...(unidad !== "NH4"
                    ? [
                        {
                          etiqueta: "Amonio como NH₄⁺",
                          formula: `C / ${unidad === "N" ? 14 : 17} × 18`,
                          sustitucion: `${conc(total)} / ${unidad === "N" ? 14 : 17} × 18`,
                          valor: `${conc(r.total.NH4)} mg NH₄⁺/L`,
                        },
                      ]
                    : []),
                  { etiqueta: "pKa", formula: "0,09018 + 2729,92 / (t + 273,16)", sustitucion: `0,09018 + 2729,92 / (${fmt(t, 2)} + 273,16)`, valor: fmt(r.pKa, 5) },
                  { etiqueta: "y", formula: "pKa − pH", sustitucion: `${fmt(r.pKa, 5)} − ${fmt(pH, 2)}`, valor: fmt(r.y, 5) },
                  { etiqueta: "F", formula: "1 / (1 + 10^y)", sustitucion: `1 / (1 + 10^${fmt(r.y, 5)})`, valor: fmt(r.fraccion, 7) },
                  { etiqueta: "NH₃ libre (como NH₄⁺)", formula: "F · C_NH₄", sustitucion: `${fmt(r.fraccion, 7)} · ${conc(r.total.NH4)}`, valor: `${conc(r.libre.NH4)} mg/L` },
                  { etiqueta: "NH₃ libre (como NH₃)", formula: "F · C_NH₄ · 17/18", sustitucion: `${conc(r.libre.NH4)} · 17/18`, valor: `${conc(r.libre.NH3)} mg NH₃/L` },
                  { etiqueta: "NH₃ libre (como N)", formula: "F · C_NH₄ · 14/18", sustitucion: `${conc(r.libre.NH4)} · 14/18`, valor: `${conc(r.libre.N)} mg N/L` },
                  ...(maximo !== null
                    ? [
                        {
                          etiqueta: "Amonio total máximo",
                          formula: "límite / F (convertido)",
                          sustitucion: `${conc(limite!)} ${NOMBRE_UNIDAD[unidadLimite]} / ${fmt(r.fraccion, 7)}`,
                          valor: `${conc(maximo)} ${NOMBRE_UNIDAD[unidad]}`,
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}

          {resultadosMuestras && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Resultados por muestra</p>
                <div className="flex gap-1.5 print:hidden">
                  <button type="button" className={botonArchivo} onClick={() => descargarXlsx([tablaSalida()], "amoniaco-libre.xlsx")}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    .xlsx
                  </button>
                  <button type="button" className={botonArchivo} onClick={() => descargarCsv(tablaSalida(), "amoniaco-libre.csv")}>
                    <Download className="h-3.5 w-3.5" />
                    .csv
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                    <tr>
                      {["Muestra", "F", "NH₃ (mg NH₃/L)", "NH₃ (mg N/L)", ...(limite !== null ? ["Límite"] : [])].map((h) => (
                        <th key={h} scope="col" className="px-2 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosMuestras.map(({ m, r }) => {
                      const cumple = limite === null ? null : r.libre[unidadLimite] <= limite;
                      return (
                        <tr key={m.etiqueta} className="border-t border-border/40">
                          <td className="px-2 py-1 text-left font-sans">{m.etiqueta}</td>
                          <td className="px-2 py-1">{fmt(r.fraccion * 100, 3)} %</td>
                          <td className="px-2 py-1">{conc(r.libre.NH3)}</td>
                          <td className="px-2 py-1">{conc(r.libre.N)}</td>
                          {cumple !== null && <td className={`px-2 py-1 ${cumple ? "" : "font-semibold text-destructive"}`}>{cumple ? "Cumple" : "No cumple"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <GraficoLineas
            titulo="Fracción de NH₃ libre según el pH"
            series={temps.map((T) => {
              const k = TEMPERATURAS_CURVA.indexOf(T);
              return {
                id: `t${T}`,
                nombre: `${fmt(T, T % 1 ? 1 : 0)} °C${k < 0 ? " (muestra)" : ""}`,
                color: k >= 0 ? COLOR_T[k] : "var(--foreground)",
                discontinua: k < 0,
                puntos: phs.map((x) => ({ x, y: fraccionLibre(x, T) * 100 })),
              };
            })}
            destacados={
              r
                ? [{ x: pH, y: r.fraccion * 100, etiqueta: `muestra: ${fmt(r.fraccion * 100, 2)} %`, color: "var(--foreground)" }]
                : resultadosMuestras
                  ? resultadosMuestras.map(({ m, r }) => ({ x: m.pH, y: r.fraccion * 100, etiqueta: m.etiqueta, color: "var(--foreground)" }))
                  : []
            }
            formatoX={(x) => fmt(x, 1)}
            formatoY={(y) => `${fmt(y, 0)} %`}
            formatoXTooltip={(x) => `pH ${fmt(x, 2)}`}
            formatoValor={(y) => `${fmt(y, 2)} %`}
            ejeX="pH"
            ejeY="NH₃ libre / amonio total (%)"
            desdeCero
            alto={240}
          />
        </div>
      </div>
    </main>
  );
}
