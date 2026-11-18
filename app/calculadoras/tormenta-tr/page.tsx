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
import { BarrasHietograma } from "@/components/calculadoras/graficos/BarrasHietograma";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import {
  analizarTormenta,
  coefArea,
  coefDuracion,
  COLUMNAS_HIETOGRAMA,
  COLUMNAS_IDF,
  COLUMNAS_MAXIMOS,
  HIETOGRAMA_EJEMPLO,
  intensidadIdf,
  MAXIMOS_EJEMPLO,
  riesgoEnAnios,
  TABLA_IDF_EJEMPLO,
  T_MAX,
  validarHietograma,
  validarMaximos,
  validarTablaIdf,
  variableGumbel,
  type ModeloIdf,
  type PeriodoRetorno,
  type ResultadoTormenta,
} from "@/lib/calc/hidraulica/tormenta";
import { descargarCsv, descargarXlsx, numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("tormenta-tr");

const METODOS = {
  "Uruguay (Rodríguez Fontal)": "uruguay",
  "Fórmula IDF": "formula",
  "Tabla IDF": "tabla",
  "Gumbel (máximos anuales)": "gumbel",
} as const;
type Metodo = (typeof METODOS)[keyof typeof METODOS];

const MODOS_TORMENTA = ["Hietograma (lluvia por intervalo)", "Lluvia acumulada", "Lluvia total y duración"] as const;

const TR_CURVAS = [2, 5, 10, 25, 50, 100];
/** Escala secuencial de un solo tono para las curvas IDF: T más alto, más oscuro. */
const COLOR_CURVA = (k: number) => `color-mix(in oklab, var(--serie-1) ${30 + k * 14}%, var(--background))`;

function textoTr(p: PeriodoRetorno): string {
  if (p.fuera === "menor") return "< 1 año";
  if (p.fuera === "mayor") return `> ${fmt(T_MAX, 0)} años`;
  return `${fmt(p.T, p.T < 10 ? 1 : 0)} años`;
}

function textoDuracion(min: number): string {
  if (min < 60) return `${fmt(min, 0)} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${fmt(h, 2)} h`;
}

/** Hasta ~25 duraciones repartidas en escala logarítmica para la tabla. */
function indicesTabla(n: number): number[] {
  if (n <= 25) return Array.from({ length: n }, (_, i) => i);
  const set = new Set<number>([0, n - 1]);
  for (let k = 0; k < 25; k++) set.add(Math.round(Math.exp((Math.log(n) * k) / 24)) - 1);
  return [...set].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
}

function tablaSalida(r: ResultadoTormenta): TablaSalida {
  return {
    hoja: "TR por duración",
    encabezados: ["duracion_min", "lamina_max_mm", "intensidad_mm_h", "tr_anios", "fuera_de_rango"],
    filas: r.maximos.map((m) => [m.duracionMin, m.laminaMm, m.intensidadMmH, m.T, m.fuera ?? ""]),
    formatos: ["0", "0.00", "0.00", "0.0", undefined],
  };
}

export default function TormentaTrPage() {
  const [metodoNombre, setMetodoNombre] = useCampo("metodo", "Uruguay (Rodríguez Fontal)");
  const metodo: Metodo = METODOS[metodoNombre as keyof typeof METODOS] ?? "uruguay";
  const [modo, setModo] = useCampo("modo", MODOS_TORMENTA[0]);
  const [intervaloTexto, setIntervalo] = useCampo("intervalo", "5");
  const [hieto, setHieto] = useTabla("hietograma", HIETOGRAMA_EJEMPLO);
  const [totalTexto, setTotal] = useCampo("total", "60");
  const [duracionTexto, setDuracion] = useCampo("duracion", "120");
  // IDF
  const [p310Texto, setP310] = useCampo("p310", "85");
  const [areaTexto, setArea] = useCampo("area", "0");
  const [kTexto, setK] = useCampo("K", "800");
  const [mTexto, setM] = useCampo("m", "0,2");
  const [cTexto, setC] = useCampo("c", "10");
  const [nTexto, setN] = useCampo("n", "0,75");
  const [tablaIdf, setTablaIdf] = useTabla("tablaIdf", TABLA_IDF_EJEMPLO);
  const [tablaEn, setTablaEn] = useCampo("tablaEn", "Intensidad (mm/h)");
  const [maximos, setMaximos] = useTabla("maximos", MAXIMOS_EJEMPLO);
  const [riesgoAniosTexto, setRiesgoAnios] = useCampo("riesgoAnios", "25");

  const errores: string[] = [];
  const num = (t: string, nombre: string, min = 0, estricto = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (estricto ? v <= min : v < min)) errores.push(`${nombre} tiene que ser un número ${estricto ? "mayor que" : "≥"} ${min}.`);
    return v;
  };

  // ── Tormenta
  const hietogramaPorIntervalo = modo !== "Lluvia total y duración";
  const validacionHieto = useMemo(() => validarHietograma(hieto, modo === "Lluvia acumulada"), [hieto, modo]);
  let lluvias: number[] | null = null;
  let intervalo = NaN;
  let etiquetas: string[] = [];
  if (hietogramaPorIntervalo) {
    intervalo = num(intervaloTexto, "El intervalo");
    lluvias = validacionHieto.lluvias;
    etiquetas = hieto.filter((f) => f.some((c) => (c ?? "").trim() !== "")).map((f, i) => (f[0] ?? "").trim() || String(i + 1));
  } else {
    const total = num(totalTexto, "La lluvia total");
    intervalo = num(duracionTexto, "La duración");
    lluvias = [total];
    etiquetas = ["total"];
  }

  // ── IDF
  const validacionTabla = useMemo(() => validarTablaIdf(tablaIdf, tablaEn.startsWith("Lámina")), [tablaIdf, tablaEn]);
  const validacionMaximos = useMemo(() => validarMaximos(maximos), [maximos]);
  let modelo: ModeloIdf | null = null;
  if (metodo === "uruguay") {
    modelo = { tipo: "uruguay", p310Mm: num(p310Texto, "P(3,10)"), areaKm2: num(areaTexto, "El área", 0, false) };
  } else if (metodo === "formula") {
    modelo = { tipo: "formula", K: num(kTexto, "K"), m: num(mTexto, "m"), c: num(cTexto, "c", 0, false), n: num(nTexto, "n") };
  } else if (metodo === "tabla") {
    modelo = validacionTabla.puntos ? { tipo: "tabla", puntos: validacionTabla.puntos } : null;
  } else {
    modelo = validacionMaximos.ajustes ? { tipo: "gumbel", ajustes: validacionMaximos.ajustes } : null;
  }

  const r = errores.length === 0 && lluvias && modelo ? analizarTormenta(lluvias, intervalo, modelo) : null;
  const riesgoAnios = aNumero(riesgoAniosTexto);

  // Curvas IDF y tormenta en escala log de la duración.
  const dMin = Math.min(5, intervalo || 5);
  const dMax = Math.max(1440, r?.duracionTotalMin ?? 0);
  const xs = Array.from({ length: 41 }, (_, k) => Math.log10(dMin) + ((Math.log10(dMax) - Math.log10(dMin)) * k) / 40);
  const marcasX = [5, 10, 15, 30, 60, 120, 360, 720, 1440, 2880].filter((d) => d >= dMin && d <= dMax).map(Math.log10);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={metodoNombre} onMetodoChange={setMetodoNombre} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Tormenta</p>
            <CampoSeleccion id="modo" etiqueta="Cargar la tormenta como" valor={modo} opciones={MODOS_TORMENTA} onChange={setModo} />
            {hietogramaPorIntervalo ? (
              <>
                <div className="w-40">
                  <CampoNumerico id="intervalo" etiqueta="Intervalo Δt" sufijo="min" valor={intervaloTexto} onChange={setIntervalo} />
                </div>
                <BarraArchivos
                  id="hieto"
                  especs={COLUMNAS_HIETOGRAMA}
                  onImportar={setHieto}
                  plantilla={() => [
                    {
                      hoja: "Hietograma",
                      encabezados: ["tiempo", "lluvia_mm"],
                      filas: HIETOGRAMA_EJEMPLO.map(([t, p]) => [t, numeroDeCelda(p)]),
                    },
                  ]}
                  nombrePlantilla="plantilla-hietograma"
                />
                <TablaEditable
                  id="tabla-hieto"
                  columnas={[
                    { titulo: "Hora / etiqueta", texto: true },
                    { titulo: modo === "Lluvia acumulada" ? "Lluvia acumulada" : "Lluvia del intervalo", sufijo: "mm" },
                  ]}
                  filas={hieto}
                  onChange={setHieto}
                  filasConError={filasDeErrores(validacionHieto.errores)}
                  porPagina={48}
                  filaNueva={() => ["", ""]}
                />
                <p className="text-xs text-muted-foreground">
                  Registros de pluviógrafo a intervalo fijo. La primera columna es sólo una etiqueta; los intervalos tienen que ser
                  consecutivos y del mismo largo.
                </p>
                <ListaErrores titulo="Errores en el hietograma" errores={validacionHieto.errores} />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="total" etiqueta="Lluvia total" sufijo="mm" valor={totalTexto} onChange={setTotal} />
                <CampoNumerico id="duracion" etiqueta="Duración" sufijo="min" valor={duracionTexto} onChange={setDuracion} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Curvas intensidad-duración-frecuencia</p>
            {metodo === "uruguay" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <CampoNumerico
                    id="p310"
                    etiqueta="P(3,10) del punto"
                    sufijo="mm"
                    valor={p310Texto}
                    onChange={setP310}
                    advertencia="Lluvia de 3 h y 10 años, del mapa de isohietas de Rodríguez Fontal."
                  />
                  <CampoNumerico
                    id="area"
                    etiqueta="Área de la cuenca"
                    sufijo="km²"
                    valor={areaTexto}
                    onChange={setArea}
                    advertencia="0 para lluvia puntual (pluviómetro). Con área aplica CA(A, d)."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  P(d,T,A) = P(3,10) · CT(T) · CD(d) · CA(A,d), con CT(T) = 0,5786 − 0,4312·log[ln(T/(T−1))]; CD(d) = 0,6208·d/(d+0,0137)^0,5639
                  si d &lt; 3 h y 1,0287·d/(d+1,0293)^0,8083 si d ≥ 3 h; CA = 1 − 0,3549·d^−0,4272·(1 − e^(−0,005792·A)).
                </p>
              </>
            )}
            {metodo === "formula" && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <CampoNumerico id="K" etiqueta="K" valor={kTexto} onChange={setK} />
                  <CampoNumerico id="m" etiqueta="m" valor={mTexto} onChange={setM} />
                  <CampoNumerico id="c" etiqueta="c" sufijo="min" valor={cTexto} onChange={setC} />
                  <CampoNumerico id="n" etiqueta="n" valor={nTexto} onChange={setN} />
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  i = K·T^m / (d + c)^n, con i en mm/h, d en minutos y T en años (Sherman / Talbot generalizada). Los valores por defecto
                  son de ejemplo: cargá los de la IDF de tu ciudad.
                </p>
              </>
            )}
            {metodo === "tabla" && (
              <>
                <CampoSeleccion
                  id="tablaEn"
                  etiqueta="La tabla trae"
                  valor={tablaEn.startsWith("Lámina") ? "Lámina (mm)" : "Intensidad (mm/h)"}
                  opciones={["Intensidad (mm/h)", "Lámina (mm)"]}
                  onChange={setTablaEn}
                />
                <BarraArchivos
                  id="idf"
                  especs={COLUMNAS_IDF}
                  onImportar={setTablaIdf}
                  plantilla={() => [
                    {
                      hoja: "IDF",
                      encabezados: ["duracion_min", "tr_anios", "intensidad_mm_h"],
                      filas: TABLA_IDF_EJEMPLO.map((f) => f.map((x) => numeroDeCelda(x))),
                    },
                  ]}
                  nombrePlantilla="plantilla-idf"
                />
                <TablaEditable
                  id="tabla-idf"
                  columnas={[
                    { titulo: "Duración", sufijo: "min" },
                    { titulo: "TR", sufijo: "años" },
                    { titulo: tablaEn.startsWith("Lámina") ? "Lámina" : "Intensidad", sufijo: tablaEn.startsWith("Lámina") ? "mm" : "mm/h" },
                  ]}
                  filas={tablaIdf}
                  onChange={setTablaIdf}
                  filasConError={filasDeErrores(validacionTabla.errores)}
                  porPagina={18}
                />
                <p className="text-xs text-muted-foreground">
                  Una fila por duración y TR. Entre TR se interpola en la variable de Gumbel y entre duraciones en log-log.
                </p>
                <ListaErrores titulo="Errores en la tabla IDF" errores={validacionTabla.errores} />
              </>
            )}
            {metodo === "gumbel" && (
              <>
                <BarraArchivos
                  id="maximos"
                  especs={COLUMNAS_MAXIMOS}
                  onImportar={setMaximos}
                  plantilla={() => [
                    {
                      hoja: "Máximos anuales",
                      encabezados: ["anio", "duracion_min", "precipitacion_mm"],
                      filas: MAXIMOS_EJEMPLO.map((f) => f.map((x) => numeroDeCelda(x))),
                    },
                  ]}
                  nombrePlantilla="plantilla-maximos-anuales"
                />
                <TablaEditable
                  id="tabla-maximos"
                  columnas={[{ titulo: "Año" }, { titulo: "Duración", sufijo: "min" }, { titulo: "Lluvia máxima", sufijo: "mm" }]}
                  filas={maximos}
                  onChange={setMaximos}
                  filasConError={filasDeErrores(validacionMaximos.errores)}
                  porPagina={20}
                />
                <p className="text-xs text-muted-foreground">
                  Lluvia máxima de cada año para cada duración, de un pluviógrafo. Los valores por defecto son sintéticos, para mostrar
                  el formato.
                </p>
                <ListaErrores titulo="Errores en los máximos anuales" errores={validacionMaximos.errores} />
                {validacionMaximos.ajustes && (
                  <div className="overflow-x-auto rounded-lg border border-border/70">
                    <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                      <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left font-sans text-xs font-medium">
                        Ajuste de Gumbel por momentos
                      </caption>
                      <thead className="font-sans text-[11px] text-muted-foreground">
                        <tr>
                          {["Duración", "Años", "Media", "Desvío", "μ", "β", "P(10 años)", "P(100 años)"].map((t) => (
                            <th key={t} scope="col" className="px-2 py-1 font-medium">
                              {t}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validacionMaximos.ajustes.map((a) => (
                          <tr key={a.duracionMin} className="border-t border-border/40">
                            <td className="px-2 py-1">{textoDuracion(a.duracionMin)}</td>
                            <td className="px-2 py-1">{a.n}</td>
                            <td className="px-2 py-1">{fmt(a.media, 1)}</td>
                            <td className="px-2 py-1">{fmt(a.desvio, 2)}</td>
                            <td className="px-2 py-1">{fmt(a.mu, 2)}</td>
                            <td className="px-2 py-1">{fmt(a.beta, 2)}</td>
                            <td className="px-2 py-1">{fmt(a.mu + a.beta * variableGumbel(10), 1)}</td>
                            <td className="px-2 py-1">{fmt(a.mu + a.beta * variableGumbel(100), 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {!r || !modelo ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">Cargá la tormenta y la IDF para calcular el período de retorno.</div>
          ) : (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  {
                    etiqueta: "TR de la tormenta",
                    valor: textoTr(r.critico),
                    nota: `duración crítica ${textoDuracion(r.critico.duracionMin)}`,
                    destacada: true,
                  },
                  {
                    etiqueta: "En la duración crítica",
                    valor: `${fmt(r.critico.laminaMm, 1)} mm`,
                    nota: `${fmt(r.critico.intensidadMmH, 1)} mm/h`,
                  },
                  {
                    etiqueta: "Lluvia total",
                    valor: `${fmt(r.laminaTotalMm, 1)} mm`,
                    nota: `en ${textoDuracion(r.duracionTotalMin)}: TR ${textoTr(r.total)}`,
                  },
                  {
                    etiqueta: "Probabilidad anual",
                    valor: r.critico.fuera ? "—" : `${fmt(100 / r.critico.T, r.critico.T > 100 ? 2 : 1)} %`,
                    nota: Number.isFinite(riesgoAnios) && !r.critico.fuera ? `${fmt(riesgoEnAnios(r.critico.T, riesgoAnios) * 100, 0)} % en ${fmt(riesgoAnios, 0)} años` : undefined,
                  },
                ]}
              />
              <ListaAvisos avisos={r.avisos} />

              {hietogramaPorIntervalo && lluvias && (
                <BarrasHietograma
                  lluviasMm={lluvias}
                  etiquetas={etiquetas}
                  intervaloMin={intervalo}
                  ventana={[r.critico.inicio, Math.round(r.critico.duracionMin / intervalo)]}
                  etiquetaVentana={`ventana crítica de ${textoDuracion(r.critico.duracionMin)}`}
                />
              )}

              <GraficoLineas
                titulo="La tormenta sobre las curvas IDF"
                series={[
                  ...TR_CURVAS.map((T, k) => ({
                    id: `T${T}`,
                    nombre: `T = ${T} años`,
                    color: COLOR_CURVA(k),
                    puntos: xs.map((x) => ({ x, y: intensidadIdf(modelo!, 10 ** x, T) })),
                  })),
                  {
                    id: "tormenta",
                    nombre: "Tormenta (máximo por duración)",
                    color: "var(--serie-2)",
                    soloMarcadores: r.maximos.length < 3,
                    puntos: r.maximos.map((m) => ({ x: Math.log10(m.duracionMin), y: m.intensidadMmH })),
                  },
                ]}
                destacados={[
                  {
                    x: Math.log10(r.critico.duracionMin),
                    y: r.critico.intensidadMmH,
                    etiqueta: `TR ${textoTr(r.critico)}`,
                    color: "var(--serie-2)",
                  },
                ]}
                ticksX={marcasX}
                formatoX={(x) => textoDuracion(Math.round(10 ** x))}
                formatoY={(y) => fmt(y, 0)}
                formatoXTooltip={(x) => `d = ${textoDuracion(Math.round(10 ** x))}`}
                formatoValor={(y) => `${fmt(y, 1)} mm/h`}
                ejeX="Duración (escala logarítmica)"
                ejeY="Intensidad (mm/h)"
                desdeCero
                alto={300}
              />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">TR por duración</p>
                  <div className="flex gap-1.5 print:hidden">
                    <button type="button" className={botonArchivo} onClick={() => descargarXlsx([tablaSalida(r)], "tr-tormenta.xlsx")}>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      .xlsx
                    </button>
                    <button type="button" className={botonArchivo} onClick={() => descargarCsv(tablaSalida(r), "tr-tormenta.csv")}>
                      <Download className="h-3.5 w-3.5" />
                      .csv
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-auto rounded-lg border border-border/70">
                  <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                    <thead className="sticky top-0 bg-muted font-sans text-[11px] text-muted-foreground">
                      <tr>
                        {["Duración", "Lámina máx. (mm)", "Intensidad (mm/h)", "TR"].map((t) => (
                          <th key={t} scope="col" className="px-2 py-1.5 font-medium">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {indicesTabla(r.maximos.length).map((i) => {
                        const m = r.maximos[i];
                        const esCritico = m.duracionMin === r.critico.duracionMin;
                        return (
                          <tr key={i} className={`border-t border-border/40 ${esCritico ? "bg-accent/60 font-semibold" : ""}`}>
                            <td className="px-2 py-1">{textoDuracion(m.duracionMin)}</td>
                            <td className="px-2 py-1">{fmt(m.laminaMm, 2)}</td>
                            <td className="px-2 py-1">{fmt(m.intensidadMmH, 2)}</td>
                            <td className="px-2 py-1">{textoTr(m)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-end gap-3">
                  <div className="w-44">
                    <CampoNumerico id="riesgoAnios" etiqueta="Riesgo en un lapso de" sufijo="años" valor={riesgoAniosTexto} onChange={setRiesgoAnios} />
                  </div>
                  <p className="pb-2 text-xs text-muted-foreground">Probabilidad de que se iguale o supere al menos una vez: 1 − (1 − 1/T)ⁿ.</p>
                </div>
              </div>

              <PanelFormulas titulo={`Ver cálculo · duración crítica ${textoDuracion(r.critico.duracionMin)}`} filas={filasDetalle(r, modelo, intervalo)} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function filasDetalle(r: ResultadoTormenta, modelo: ModeloIdf, intervalo: number) {
  const c = r.critico;
  const k = Math.round(c.duracionMin / intervalo);
  const filas: { etiqueta: string; formula?: string; sustitucion?: string; valor: string }[] = [
    {
      etiqueta: "P_máx(d)",
      formula: `máx Σ de ${k} intervalo${k > 1 ? "s" : ""} consecutivos`,
      sustitucion: `ventana desde el intervalo ${c.inicio + 1} hasta el ${c.inicio + k}`,
      valor: `${fmt(c.laminaMm, 2)} mm`,
    },
    { etiqueta: "i", formula: "P_máx / d", sustitucion: `${fmt(c.laminaMm, 2)} / ${fmt(c.duracionMin / 60, 4)} h`, valor: `${fmt(c.intensidadMmH, 2)} mm/h` },
  ];
  if (modelo.tipo === "uruguay") {
    const dh = c.duracionMin / 60;
    const cd = coefDuracion(dh);
    const ca = coefArea(modelo.areaKm2, dh);
    const ct = c.laminaMm / (modelo.p310Mm * cd * ca);
    const z = 10 ** ((0.5786 - ct) / 0.4312);
    filas.push(
      {
        etiqueta: "CD(d)",
        formula: dh < 3 ? "0,6208·d / (d + 0,0137)^0,5639" : "1,0287·d / (d + 1,0293)^0,8083",
        sustitucion: dh < 3 ? `0,6208·${fmt(dh, 4)} / (${fmt(dh, 4)} + 0,0137)^0,5639` : `1,0287·${fmt(dh, 4)} / (${fmt(dh, 4)} + 1,0293)^0,8083`,
        valor: fmt(cd, 4),
      },
      {
        etiqueta: "CA(A,d)",
        formula: "1 − 0,3549·d^−0,4272·(1 − e^(−0,005792·A))",
        sustitucion: `1 − 0,3549·${fmt(dh, 4)}^−0,4272·(1 − e^(−0,005792·${fmt(modelo.areaKm2, 2)}))`,
        valor: fmt(ca, 4),
      },
      {
        etiqueta: "CT necesario",
        formula: "P_máx / (P(3,10)·CD·CA)",
        sustitucion: `${fmt(c.laminaMm, 2)} / (${fmt(modelo.p310Mm, 1)} · ${fmt(cd, 4)} · ${fmt(ca, 4)})`,
        valor: fmt(ct, 4),
      },
      {
        etiqueta: "T",
        formula: "e^z / (e^z − 1), z = 10^((0,5786 − CT)/0,4312)",
        sustitucion: `z = 10^((0,5786 − ${fmt(ct, 4)})/0,4312) = ${fmt(z, 5)}`,
        valor: textoTr(c),
      }
    );
  } else if (modelo.tipo === "formula") {
    filas.push({
      etiqueta: "T",
      formula: "(i·(d + c)^n / K)^(1/m)",
      sustitucion: `(${fmt(c.intensidadMmH, 2)}·(${fmt(c.duracionMin, 1)} + ${fmt(modelo.c, 2)})^${fmt(modelo.n, 3)} / ${fmt(modelo.K, 2)})^(1/${fmt(modelo.m, 3)})`,
      valor: textoTr(c),
    });
  } else {
    filas.push(
      {
        etiqueta: "T",
        formula:
          modelo.tipo === "tabla"
            ? "i_IDF(d, T) = i_tormenta; lineal en y = −ln(−ln(1 − 1/T)) entre TR, log-log entre duraciones"
            : "P = μ_d + β_d·y(T) (Gumbel); log-log entre duraciones; despeje por bisección",
        sustitucion: c.fuera ? "fuera del rango calculable" : `y(T) = ${fmt(variableGumbel(c.T), 4)}`,
        valor: textoTr(c),
      },
      { etiqueta: "Comprobación", formula: "i_IDF(d, T)", valor: `${fmt(intensidadIdf(modelo, c.duracionMin, c.T), 2)} mm/h` }
    );
  }
  filas.push({ etiqueta: "Probabilidad anual", formula: "1 / T", valor: c.fuera ? "—" : `${fmt(100 / c.T, 2)} %` });
  return filas;
}
