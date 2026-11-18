"use client";

import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import {
  calcularBalance,
  COLUMNAS_CURVA,
  COLUMNAS_SERIE,
  cotaDeVolumen,
  CURVA_EJEMPLO,
  serieEjemplo,
  validarCurva,
  validarSerie,
  type PasoBalance,
  type PasoTiempo,
  type PuntoCurva,
} from "@/lib/calc/hidraulica/balance-embalse";
import { descargarCsv, descargarXlsx, numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("balance-embalse");

const NOMBRE_PASO: Record<string, PasoTiempo> = {
  "Paso mensual": "mensual",
  "Paso diario": "diario",
};

// Constantes de módulo: useTabla compara la tabla inicial por referencia.
const SERIE_EJEMPLO_MENSUAL = serieEjemplo("mensual");
const SERIE_EJEMPLO_DIARIA = serieEjemplo("diario");

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCorta(iso: string, paso: PasoTiempo): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m) return iso;
  return paso === "mensual" ? `${MESES[+m - 1]} ${a}` : `${d}/${m}/${a}`;
}

function fechaUtc(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function plantillaSerie(paso: PasoTiempo): TablaSalida[] {
  const filas = paso === "mensual" ? SERIE_EJEMPLO_MENSUAL : SERIE_EJEMPLO_DIARIA;
  const lamina = paso === "mensual" ? "mm en el mes" : "mm en el día";
  return [
    {
      hoja: `Serie ${paso}`,
      encabezados: COLUMNAS_SERIE.map((c) => c.nombre),
      filas: filas.map(([f, ...v]) => [fechaUtc(f), ...v.map((x) => numeroDeCelda(x))]),
      formatos: [paso === "mensual" ? "yyyy-mm" : "yyyy-mm-dd", "0.00", "0.0", "0.0", "0.00"],
    },
    {
      hoja: "Instrucciones",
      encabezados: ["columna", "contenido", "unidad"],
      filas: [
        ["fecha", paso === "mensual" ? "Un mes por fila, consecutivos (cualquier día del mes)" : "Un día por fila, consecutivos", "aaaa-mm-dd"],
        ["aporte_m3s", "Caudal medio de aporte al embalse en el paso", "m³/s"],
        ["precipitacion_mm", "Lámina de lluvia sobre el espejo de agua", lamina],
        ["evaporacion_mm", "Lámina evaporada del espejo (ya corregida por coeficiente de tanque, si corresponde)", lamina],
        ["extraccion_m3s", "Caudal medio extraído para usos (riego, agua potable, energía…)", "m³/s"],
        ["", "Sin celdas vacías ni valores negativos. Los encabezados pueden llevar tildes o mayúsculas.", ""],
      ],
    },
  ];
}

function plantillaCurva(): TablaSalida[] {
  return [
    {
      hoja: "Curva",
      encabezados: COLUMNAS_CURVA.map((c) => c.nombre),
      filas: CURVA_EJEMPLO.map((f) => f.map((x) => numeroDeCelda(x))),
      formatos: ["0.00", "0.0", "0.000"],
    },
  ];
}

function tablaResultados(pasos: PasoBalance[], paso: PasoTiempo): TablaSalida {
  return {
    hoja: "Balance",
    encabezados: [
      "fecha",
      "dias",
      "V_inicial_hm3",
      "area_ha",
      "aporte_hm3",
      "precipitacion_hm3",
      "evaporacion_hm3",
      "extraccion_hm3",
      "ecologico_hm3",
      "infiltracion_hm3",
      "deltaV_hm3",
      "vertido_hm3",
      "deficit_hm3",
      "V_final_hm3",
      "cota_final_m",
    ],
    filas: pasos.map((p) => [
      fechaUtc(p.fecha),
      p.duracionS / 86400,
      p.volumenInicialHm3,
      p.areaHa,
      p.aporteHm3,
      p.precipitacionHm3,
      p.evaporacionHm3,
      p.extraccionHm3,
      p.ecologicoHm3,
      p.infiltracionHm3,
      p.deltaVHm3,
      p.vertidoHm3,
      p.deficitHm3,
      p.volumenFinalHm3,
      p.cotaFinalM,
    ]),
    formatos: [paso === "mensual" ? "yyyy-mm" : "yyyy-mm-dd", "0", ...Array(12).fill("0.0000"), "0.000"],
  };
}

/** Tramo de la curva donde cae un volumen, para escribir la interpolación. */
function tramoCurva(curva: PuntoCurva[], v: number): [PuntoCurva, PuntoCurva] {
  for (let i = 0; i < curva.length - 1; i++) {
    if (v <= curva[i + 1].volumenHm3) return [curva[i], curva[i + 1]];
  }
  return [curva[curva.length - 2], curva[curva.length - 1]];
}

/** Hasta ~7 marcas del eje de tiempo, repartidas parejo. */
function marcasTiempo(n: number): number[] {
  if (n <= 1) return [0];
  const paso = Math.max(1, Math.ceil((n - 1) / 6));
  const marcas: number[] = [];
  for (let i = 0; i < n; i += paso) marcas.push(i);
  return marcas;
}

const COLUMNAS_TABLA_SERIE = [
  { titulo: "Fecha", ejemplo: "2024-01-01", texto: true },
  { titulo: "Aporte", sufijo: "m³/s" },
  { titulo: "Precipitación", sufijo: "mm" },
  { titulo: "Evaporación", sufijo: "mm" },
  { titulo: "Extracción", sufijo: "m³/s" },
];

const COLUMNAS_TABLA_CURVA = [
  { titulo: "Cota", sufijo: "m" },
  { titulo: "Área", sufijo: "ha" },
  { titulo: "Volumen", sufijo: "hm³" },
];

function siguienteFecha(filas: string[][], paso: PasoTiempo): string {
  const ultima = filas[filas.length - 1]?.[0];
  const m = ultima?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (paso === "mensual") d.setUTCMonth(d.getUTCMonth() + 1, 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function BalanceEmbalsePage() {
  const [pasoNombre, setPasoNombre] = useCampo("paso", "Paso mensual");
  const paso = NOMBRE_PASO[pasoNombre] ?? "mensual";
  const [serieMensual, setSerieMensual] = useTabla("serie-mensual", SERIE_EJEMPLO_MENSUAL);
  const [serieDiaria, setSerieDiaria] = useTabla("serie-diaria", SERIE_EJEMPLO_DIARIA);
  const filasSerie = paso === "mensual" ? serieMensual : serieDiaria;
  const setFilasSerie = paso === "mensual" ? setSerieMensual : setSerieDiaria;
  const [filasCurva, setFilasCurva] = useTabla("curva", CURVA_EJEMPLO);

  const [ecologicoTexto, setEcologico] = useCampo("ecologico", "0,5");
  const [infiltracionTexto, setInfiltracion] = useCampo("infiltracion", "0,05");
  const [vInicialTexto, setVInicial] = useCampo("vInicial", "15");
  const [vMinTexto, setVMin] = useCampo("vMin", "1,5");
  const [vMaxTexto, setVMax] = useCampo("vMax", "21,3");
  const [pasoDetalleTexto, setPasoDetalle] = useCampo("pasoDetalle", "1");

  const valores = {
    caudalEcologicoM3s: aNumero(ecologicoTexto),
    infiltracionM3s: aNumero(infiltracionTexto),
    volumenInicialHm3: aNumero(vInicialTexto),
    volumenMinimoHm3: aNumero(vMinTexto),
    volumenMaximoHm3: aNumero(vMaxTexto),
  };

  const validacionSerie = useMemo(() => validarSerie(filasSerie, paso), [filasSerie, paso]);
  const validacionCurva = useMemo(() => validarCurva(filasCurva), [filasCurva]);
  const curva = validacionCurva.curva;

  const erroresParametros: string[] = [];
  const nombres: Record<keyof typeof valores, string> = {
    caudalEcologicoM3s: "El caudal ecológico",
    infiltracionM3s: "La infiltración",
    volumenInicialHm3: "El volumen inicial",
    volumenMinimoHm3: "El volumen mínimo",
    volumenMaximoHm3: "El volumen máximo",
  };
  for (const [k, v] of Object.entries(valores) as [keyof typeof valores, number][]) {
    if (!Number.isFinite(v)) erroresParametros.push(`${nombres[k]} no es un número.`);
    else if (v < 0) erroresParametros.push(`${nombres[k]} no puede ser negativo.`);
  }
  if (erroresParametros.length === 0) {
    if (valores.volumenMinimoHm3 >= valores.volumenMaximoHm3) {
      erroresParametros.push("El volumen mínimo tiene que ser menor que el máximo.");
    } else if (
      valores.volumenInicialHm3 < valores.volumenMinimoHm3 ||
      valores.volumenInicialHm3 > valores.volumenMaximoHm3
    ) {
      erroresParametros.push("El volumen inicial tiene que estar entre el mínimo y el máximo.");
    }
  }

  const avisos: string[] = [];
  if (curva && erroresParametros.length === 0) {
    const ultimo = curva[curva.length - 1];
    if (valores.volumenMaximoHm3 > ultimo.volumenHm3) {
      avisos.push(
        `El volumen máximo (${fmt(valores.volumenMaximoHm3, 2)} hm³) supera el último punto de la curva (${fmt(ultimo.volumenHm3, 2)} hm³): por encima se toman la cota y el área de ese punto. Extendé la curva.`
      );
    }
    if (valores.volumenMinimoHm3 < curva[0].volumenHm3) {
      avisos.push("El volumen mínimo está por debajo del primer punto de la curva: ahí se toman la cota y el área de ese punto.");
    }
  }

  // Sin useMemo: aun diez años diarios se calculan en pocos milisegundos.
  const resultado =
    validacionSerie.serie && curva && erroresParametros.length === 0
      ? calcularBalance({ paso, serie: validacionSerie.serie, curva, ...valores })
      : null;

  const n = resultado?.pasos.length ?? 0;
  const pasoDetalle = Math.min(Math.max(1, Math.round(aNumero(pasoDetalleTexto)) || 1), Math.max(1, n));
  const detalle = resultado?.pasos[pasoDetalle - 1];

  const cotaVmin = curva ? cotaDeVolumen(curva, valores.volumenMinimoHm3) : NaN;
  const cotaVmax = curva ? cotaDeVolumen(curva, valores.volumenMaximoHm3) : NaN;
  const marcas = marcasTiempo(n);
  const unidadPaso = paso === "mensual" ? "meses" : "días";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={pasoNombre} onMetodoChange={setPasoNombre} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Embalse</p>
            <CampoNumerico
              id="vInicial"
              etiqueta="Volumen inicial"
              sufijo="hm³"
              valor={vInicialTexto}
              onChange={setVInicial}
              advertencia="Volumen almacenado al comienzo del primer paso."
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="vMin"
                etiqueta="Volumen mínimo (muerto)"
                sufijo="hm³"
                valor={vMinTexto}
                onChange={setVMin}
              />
              <CampoNumerico
                id="vMax"
                etiqueta="Volumen máximo (vertedero)"
                sufijo="hm³"
                valor={vMaxTexto}
                onChange={setVMax}
              />
            </div>
            {curva && erroresParametros.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Según la curva: volumen mínimo a cota {fmt(cotaVmin, 2)} m, vertedero a cota {fmt(cotaVmax, 2)} m.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Salidas constantes</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="ecologico"
                etiqueta="Caudal ecológico liberado"
                sufijo="m³/s"
                valor={ecologicoTexto}
                onChange={setEcologico}
              />
              <CampoNumerico
                id="infiltracion"
                etiqueta="Infiltración"
                sufijo="m³/s"
                valor={infiltracionTexto}
                onChange={setInfiltracion}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se descuentan en todos los pasos, además de las extracciones de la serie.
            </p>
            <ListaErrores titulo="Revisá los datos del embalse" errores={erroresParametros} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="spec-label">Curva cota-área-volumen</p>
          <BarraArchivos
            id="curva"
            especs={COLUMNAS_CURVA}
            onImportar={setFilasCurva}
            plantilla={plantillaCurva}
            nombrePlantilla="plantilla-curva-cota-area-volumen"
          />
          <TablaEditable
            id="tabla-curva"
            columnas={COLUMNAS_TABLA_CURVA}
            filas={filasCurva}
            onChange={setFilasCurva}
            filasConError={filasDeErrores(validacionCurva.errores)}
          />
          <ListaErrores titulo="Errores en la curva" errores={validacionCurva.errores} />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="spec-label">Serie {paso === "mensual" ? "mensual" : "diaria"} de entradas y extracciones</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Caudales medios del paso en m³/s; lluvia y evaporación como lámina en mm{" "}
              {paso === "mensual" ? "del mes" : "del día"}, aplicada sobre el área del espejo. Columnas del
              archivo: {COLUMNAS_SERIE.map((c) => c.nombre).join(", ")}.
            </p>
          </div>
        </div>
        <BarraArchivos
          id="serie"
          especs={COLUMNAS_SERIE}
          onImportar={setFilasSerie}
          plantilla={() => plantillaSerie(paso)}
          nombrePlantilla={`plantilla-serie-${paso === "mensual" ? "mensual" : "diaria"}`}
        />
        <TablaEditable
          id="tabla-serie"
          columnas={COLUMNAS_TABLA_SERIE}
          filas={filasSerie}
          onChange={setFilasSerie}
          filasConError={filasDeErrores(validacionSerie.errores)}
          porPagina={paso === "mensual" ? 24 : 31}
          filaNueva={(filas) => [siguienteFecha(filas, paso), "", "0", "0", "0"]}
        />
        <ListaErrores titulo="Errores en la serie" errores={validacionSerie.errores} />
      </section>

      <section className="space-y-6">
        <p className="spec-label">Resultados</p>
        <ListaAvisos avisos={avisos} />
        {!resultado ? (
          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Corregí los errores marcados arriba para calcular el balance.
          </div>
        ) : (
          <>
            <PanelMetricas
              horizontal
              metricas={[
                {
                  etiqueta: "Volumen mínimo alcanzado",
                  valor: `${fmt(resultado.volumenMinimo.valorHm3, 2)} hm³`,
                  nota: `${fechaCorta(resultado.volumenMinimo.fecha, paso)} · cota ${fmt(resultado.cotaMinimaM, 2)} m`,
                },
                {
                  etiqueta: "Volumen máximo alcanzado",
                  valor: `${fmt(resultado.volumenMaximo.valorHm3, 2)} hm³`,
                  nota: `${fechaCorta(resultado.volumenMaximo.fecha, paso)} · cota ${fmt(resultado.cotaMaximaM, 2)} m`,
                },
                {
                  etiqueta: "Pasos con déficit",
                  valor: `${resultado.pasosConDeficit} de ${n}`,
                  nota: `Déficit total ${fmt(resultado.deficitTotalHm3, 3)} hm³`,
                  destacada: true,
                },
                {
                  etiqueta: "Pasos con vertido",
                  valor: `${resultado.pasosConVertido} de ${n}`,
                  nota: `Vertido total ${fmt(resultado.vertidoTotalHm3, 3)} hm³`,
                },
              ]}
            />

            <GraficoLineas
              titulo="Volumen almacenado al final de cada paso"
              series={[
                {
                  id: "volumen",
                  nombre: "Volumen",
                  color: "var(--serie-1)",
                  puntos: resultado.pasos.map((p, i) => ({ x: i, y: p.volumenFinalHm3 })),
                },
              ]}
              referenciasY={[
                { y: valores.volumenMaximoHm3, etiqueta: "Vertedero (Vmáx)" },
                { y: valores.volumenMinimoHm3, etiqueta: "Volumen muerto (Vmín)" },
              ]}
              formatoX={(i) => fechaCorta(resultado.pasos[Math.round(i)]?.fecha ?? "", paso)}
              formatoY={(y) => `${fmt(y, 1)}`}
              formatoValor={(y) => `${fmt(y, 3)} hm³`}
              ejeX={paso === "mensual" ? "Mes" : "Día"}
              ejeY="Volumen (hm³)"
              ticksX={marcas}
              desdeCero
              extraTooltip={(i) => {
                const p = resultado.pasos[Math.round(i)];
                if (!p) return [];
                return [
                  { etiqueta: "ΔV (hm³)", valor: fmt(p.deltaVHm3, 3) },
                  ...(p.vertidoHm3 > 1e-9 ? [{ etiqueta: "vertido (hm³)", valor: fmt(p.vertidoHm3, 3) }] : []),
                  ...(p.deficitHm3 > 1e-9 ? [{ etiqueta: "déficit (hm³)", valor: fmt(p.deficitHm3, 3) }] : []),
                ];
              }}
            />

            <GraficoLineas
              titulo="Cota del pelo de agua al final de cada paso"
              series={[
                {
                  id: "cota",
                  nombre: "Cota",
                  color: "var(--serie-1)",
                  puntos: resultado.pasos.map((p, i) => ({ x: i, y: p.cotaFinalM })),
                },
              ]}
              referenciasY={[
                { y: cotaVmax, etiqueta: "Cota de vertedero" },
                { y: cotaVmin, etiqueta: "Cota del volumen muerto" },
              ]}
              formatoX={(i) => fechaCorta(resultado.pasos[Math.round(i)]?.fecha ?? "", paso)}
              formatoY={(y) => fmt(y, 1)}
              formatoValor={(y) => `${fmt(y, 2)} m`}
              ejeX={paso === "mensual" ? "Mes" : "Día"}
              ejeY="Cota (m)"
              ticksX={marcas}
              alto={220}
            />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Balance por paso</p>
                <div className="flex gap-1.5 print:hidden">
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() => descargarXlsx([tablaResultados(resultado.pasos, paso)], "balance-embalse.xlsx")}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Exportar .xlsx
                  </button>
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() => descargarCsv(tablaResultados(resultado.pasos, paso), "balance-embalse.csv")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar .csv
                  </button>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border/70 print:max-h-none">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="sticky top-0 bg-muted text-[11px] font-sans text-muted-foreground">
                    <tr>
                      {[
                        ["#", ""],
                        ["Fecha", ""],
                        ["V inicial", "hm³"],
                        ["Área", "ha"],
                        ["Aporte", "hm³"],
                        ["Lluvia", "hm³"],
                        ["Evap.", "hm³"],
                        ["Extracción", "hm³"],
                        ["Ecológico", "hm³"],
                        ["Infiltr.", "hm³"],
                        ["ΔV", "hm³"],
                        ["Vertido", "hm³"],
                        ["Déficit", "hm³"],
                        ["V final", "hm³"],
                        ["Cota", "m"],
                      ].map(([t, u]) => (
                        <th key={t} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">
                          {t}
                          {u && <span className="block font-normal">{u}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.pasos.map((p) => (
                      <tr
                        key={p.indice}
                        className={`border-t border-border/40 ${p.indice + 1 === pasoDetalle ? "bg-accent/60" : ""}`}
                      >
                        <td className="px-2 py-1 text-muted-foreground">
                          <button
                            type="button"
                            className="underline-offset-2 hover:text-foreground hover:underline"
                            onClick={() => setPasoDetalle(String(p.indice + 1))}
                            title="Ver el cálculo de este paso"
                          >
                            {p.indice + 1}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-left">{fechaCorta(p.fecha, paso)}</td>
                        <td className="px-2 py-1">{fmt(p.volumenInicialHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.areaHa, 1)}</td>
                        <td className="px-2 py-1">{fmt(p.aporteHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.precipitacionHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.evaporacionHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.extraccionHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.ecologicoHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.infiltracionHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.deltaVHm3, 3)}</td>
                        <td className={`px-2 py-1 ${p.vertidoHm3 > 1e-9 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {fmt(p.vertidoHm3, 3)}
                        </td>
                        <td className={`px-2 py-1 ${p.deficitHm3 > 1e-9 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                          {fmt(p.deficitHm3, 3)}
                        </td>
                        <td className="px-2 py-1 font-semibold">{fmt(p.volumenFinalHm3, 3)}</td>
                        <td className="px-2 py-1">{fmt(p.cotaFinalM, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {n} {unidadPaso}. Entradas totales {fmt(resultado.entradasTotalesHm3, 2)} hm³, salidas totales{" "}
                {fmt(resultado.salidasTotalesHm3, 2)} hm³. Tocá el número de un paso para ver su cálculo.
              </p>
            </div>

            {detalle && curva && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3 print:hidden">
                  <div className="w-36">
                    <CampoNumerico
                      id="pasoDetalle"
                      etiqueta={`Paso a detallar (1 a ${n})`}
                      valor={pasoDetalleTexto}
                      onChange={setPasoDetalle}
                    />
                  </div>
                  <p className="pb-2 text-sm text-muted-foreground">{fechaCorta(detalle.fecha, paso)}</p>
                </div>
                <PanelFormulas
                  titulo={`Ver cálculo · paso ${pasoDetalle} (${fechaCorta(detalle.fecha, paso)})`}
                  filas={filasDetalle(detalle, curva, valores.volumenMinimoHm3, valores.volumenMaximoHm3, validacionSerie.serie![detalle.indice], valores.caudalEcologicoM3s, valores.infiltracionM3s, paso)}
                />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function filasDetalle(
  p: PasoBalance,
  curva: PuntoCurva[],
  vMin: number,
  vMax: number,
  reg: { aporteM3s: number; precipitacionMm: number; evaporacionMm: number; extraccionM3s: number },
  ecologico: number,
  infiltracion: number,
  paso: PasoTiempo
) {
  const dt = p.duracionS;
  const dias = dt / 86400;
  const [a, b] = tramoCurva(curva, p.volumenMedioHm3);
  const [c, d] = tramoCurva(curva, p.volumenFinalHm3);
  const dtTexto = fmt(dt, 0);
  return [
    {
      etiqueta: "Δt",
      formula: paso === "mensual" ? "días del mes · 86 400 s" : "1 día · 86 400 s",
      sustitucion: `${fmt(dias, 0)} · 86 400`,
      valor: `${dtTexto} s`,
    },
    {
      etiqueta: "V_aporte",
      formula: "Q_aporte · Δt / 10⁶",
      sustitucion: `${fmt(reg.aporteM3s, 3)} · ${dtTexto} / 10⁶`,
      valor: `${fmt(p.aporteHm3, 4)} hm³`,
    },
    {
      etiqueta: "V_extracción",
      formula: "Q_extracción · Δt / 10⁶",
      sustitucion: `${fmt(reg.extraccionM3s, 3)} · ${dtTexto} / 10⁶`,
      valor: `${fmt(p.extraccionHm3, 4)} hm³`,
    },
    {
      etiqueta: "V_ecológico",
      formula: "Q_eco · Δt / 10⁶",
      sustitucion: `${fmt(ecologico, 3)} · ${dtTexto} / 10⁶`,
      valor: `${fmt(p.ecologicoHm3, 4)} hm³`,
    },
    {
      etiqueta: "V_infiltración",
      formula: "Q_inf · Δt / 10⁶",
      sustitucion: `${fmt(infiltracion, 3)} · ${dtTexto} / 10⁶`,
      valor: `${fmt(p.infiltracionHm3, 4)} hm³`,
    },
    {
      etiqueta: "V̄ (volumen medio)",
      formula: "(V_inicial + V_final) / 2",
      sustitucion: `(${fmt(p.volumenInicialHm3, 4)} + ${fmt(p.volumenFinalHm3, 4)}) / 2`,
      valor: `${fmt(p.volumenMedioHm3, 4)} hm³`,
    },
    {
      etiqueta: "A(V̄)",
      formula: "A₁ + (V̄ − V₁)·(A₂ − A₁)/(V₂ − V₁)",
      sustitucion: `${fmt(a.areaHa, 1)} + (${fmt(p.volumenMedioHm3, 4)} − ${fmt(a.volumenHm3, 3)})·(${fmt(b.areaHa, 1)} − ${fmt(a.areaHa, 1)})/(${fmt(b.volumenHm3, 3)} − ${fmt(a.volumenHm3, 3)})`,
      valor: `${fmt(p.areaHa, 2)} ha  (${p.iteraciones} iteraciones)`,
    },
    {
      etiqueta: "V_lluvia",
      formula: "P · A · 10⁻⁵",
      sustitucion: `${fmt(reg.precipitacionMm, 1)} · ${fmt(p.areaHa, 2)} · 10⁻⁵`,
      valor: `${fmt(p.precipitacionHm3, 4)} hm³`,
    },
    {
      etiqueta: "V_evaporación",
      formula: "E · A · 10⁻⁵",
      sustitucion: `${fmt(reg.evaporacionMm, 1)} · ${fmt(p.areaHa, 2)} · 10⁻⁵`,
      valor: `${fmt(p.evaporacionHm3, 4)} hm³`,
    },
    {
      etiqueta: "ΔV",
      formula: "(V_aporte + V_lluvia) − (V_extr + V_eco + V_inf + V_evap)",
      sustitucion: `(${fmt(p.aporteHm3, 4)} + ${fmt(p.precipitacionHm3, 4)}) − (${fmt(p.extraccionHm3, 4)} + ${fmt(p.ecologicoHm3, 4)} + ${fmt(p.infiltracionHm3, 4)} + ${fmt(p.evaporacionHm3, 4)})`,
      valor: `${fmt(p.deltaVHm3, 4)} hm³`,
    },
    {
      etiqueta: "V*",
      formula: "V_inicial + ΔV",
      sustitucion: `${fmt(p.volumenInicialHm3, 4)} + ${fmt(p.deltaVHm3, 4)}`,
      valor: `${fmt(p.volumenSinLimitarHm3, 4)} hm³`,
    },
    {
      etiqueta: "Vertido",
      formula: "máx(0; V* − V_máx)",
      sustitucion: `máx(0; ${fmt(p.volumenSinLimitarHm3, 4)} − ${fmt(vMax, 3)})`,
      valor: `${fmt(p.vertidoHm3, 4)} hm³`,
    },
    {
      etiqueta: "Déficit",
      formula: "máx(0; V_mín − V*)",
      sustitucion: `máx(0; ${fmt(vMin, 3)} − ${fmt(p.volumenSinLimitarHm3, 4)})`,
      valor: `${fmt(p.deficitHm3, 4)} hm³`,
    },
    {
      etiqueta: "V_final",
      formula: "mín(V_máx; máx(V_mín; V*))",
      sustitucion: `mín(${fmt(vMax, 3)}; máx(${fmt(vMin, 3)}; ${fmt(p.volumenSinLimitarHm3, 4)}))`,
      valor: `${fmt(p.volumenFinalHm3, 4)} hm³`,
    },
    {
      etiqueta: "Cota final",
      formula: "z₁ + (V_final − V₁)·(z₂ − z₁)/(V₂ − V₁)",
      sustitucion: `${fmt(c.cotaM, 2)} + (${fmt(p.volumenFinalHm3, 4)} − ${fmt(c.volumenHm3, 3)})·(${fmt(d.cotaM, 2)} − ${fmt(c.cotaM, 2)})/(${fmt(d.volumenHm3, 3)} − ${fmt(c.volumenHm3, 3)})`,
      valor: `${fmt(p.cotaFinalM, 3)} m`,
    },
  ];
}
