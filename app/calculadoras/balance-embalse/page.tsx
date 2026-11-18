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
import { PanelSensibilidad } from "@/components/calculadoras/embalse/PanelSensibilidad";
import { PanelTemez } from "@/components/calculadoras/embalse/PanelTemez";
import { aguaDisponiblePonderada, calcularTemez, PARAMETROS_TEMEZ_URUGUAY, type PasoTemez } from "@/lib/calc/hidraulica/temez";
import {
  agregarDiarioAMensual,
  areaDeVolumen,
  calcularBalance,
  COLUMNAS_CURVA,
  especsSerie,
  convertirCaudalSerie,
  cotaDeVolumen,
  CUATRIMESTRES,
  cuatrimestreDeMes,
  CURVA_EJEMPLO,
  duracionPasoS,
  FACTORES_PERCENTIL_S_SE,
  PERCENTILES,
  qambPorPercentil,
  serieEjemplo,
  unidadCaudalDeEncabezado,
  unidadCurvaDeEncabezado,
  validarCurva,
  validarSerie,
  volumenDeCota,
  type PasoBalance,
  type PasoTiempo,
  type Percentil,
  type PuntoCurva,
  type RegistroSerie,
  type ColumnasRequeridas,
  type DatosBalance,
  type UnidadCaudalSerie,
} from "@/lib/calc/hidraulica/balance-embalse";
import { descargarCsv, descargarXlsx, fechaDeCelda, numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
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

// ── Unidades ───────────────────────────────────────────────────────────────

const UNIDADES_VOLUMEN = ["hm³ y ha", "m³ y m²"] as const;

interface Escala {
  /** Unidad de pantalla por hm³ y por ha. */
  v: number;
  a: number;
  nv: string;
  na: string;
  dv: number;
  da: number;
}
function escalaDe(u: string): Escala {
  return u === "m³ y m²"
    ? { v: 1e6, a: 1e4, nv: "m³", na: "m²", dv: 0, da: 0 }
    : { v: 1, a: 1, nv: "hm³", na: "ha", dv: 3, da: 1 };
}

const UNIDADES_CAUDAL = { "m³/s": "m3s", "m³ en el paso": "volumen" } as const satisfies Record<string, UnidadCaudalSerie>;
type NombreUnidadCaudal = keyof typeof UNIDADES_CAUDAL;

function textoNumero(n: number, maxDecimales = 6): string {
  if (!Number.isFinite(n)) return "";
  return String(+n.toFixed(maxDecimales)).replace(".", ",");
}

/** Reescala una celda numérica de texto; deja como está lo que no es número. */
function reescalar(texto: string, factor: number): string {
  const n = numeroDeCelda(texto);
  return n === null || Number.isNaN(n) ? texto : textoNumero(n * factor, 8);
}

// ── Fechas y plantillas ────────────────────────────────────────────────────

function fechaCorta(iso: string, paso: PasoTiempo): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m) return iso;
  return paso === "mensual" ? `${MESES[+m - 1]} ${a}` : `${d}/${m}/${a}`;
}

function fechaUtc(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function sufijoCaudal(u: UnidadCaudalSerie, paso: PasoTiempo) {
  return u === "m3s" ? "m³/s" : paso === "mensual" ? "m³/mes" : "m³/día";
}

function plantillaSerie(paso: PasoTiempo, unidad: UnidadCaudalSerie): TablaSalida[] {
  const filas = paso === "mensual" ? SERIE_EJEMPLO_MENSUAL : SERIE_EJEMPLO_DIARIA;
  const lamina = paso === "mensual" ? "mm en el mes" : "mm en el día";
  const col = unidad === "m3s" ? "m3s" : paso === "mensual" ? "m3_mes" : "m3_dia";
  const aUnidad = (f: string, t: string) => {
    const n = numeroDeCelda(t) ?? 0;
    return unidad === "m3s" ? n : Math.round(n * duracionPasoS(f, paso));
  };
  return [
    {
      hoja: `Serie ${paso}`,
      encabezados: ["fecha", `aporte_${col}`, "precipitacion_mm", "evaporacion_mm", `demanda_${col}`, "etp_mm"],
      filas: filas.map(([f, ap, p, e, ex, etp]) => [
        fechaUtc(f),
        aUnidad(f, ap),
        numeroDeCelda(p),
        numeroDeCelda(e),
        aUnidad(f, ex),
        numeroDeCelda(etp ?? ""),
      ]),
      formatos: [paso === "mensual" ? "yyyy-mm" : "yyyy-mm-dd", unidad === "m3s" ? "0.00" : "0", "0.0", "0.0", unidad === "m3s" ? "0.00" : "0", "0.0"],
    },
    {
      hoja: "Instrucciones",
      encabezados: ["columna", "contenido", "unidad"],
      filas: [
        ["fecha", paso === "mensual" ? "Un mes por fila, consecutivos (cualquier día del mes)" : "Un día por fila, consecutivos", "aaaa-mm-dd"],
        ["aporte", "Aporte de la cuenca al embalse en el paso", "m3/s, L/s o m3 del paso: se lee del encabezado (aporte_m3s, aporte_ls, aporte_m3_mes)"],
        ["precipitacion_mm", "Lámina de lluvia sobre el espejo de agua", lamina],
        ["evaporacion_mm", "Lámina evaporada de tanque (la calculadora aplica el coeficiente de tanque)", lamina],
        ["demanda", "Volumen o caudal a suministrar en el paso (se puede dejar vacía si la demanda es constante)", "igual que el aporte"],
        ["etp_mm", "Evapotranspiración potencial de la cuenca, sólo para el modelo de Témez (opcional)", lamina],
        ["", "Sin celdas vacías ni valores negativos. Los encabezados pueden llevar tildes o mayúsculas.", ""],
      ],
    },
  ];
}

function plantillaCurva(e: Escala): TablaSalida[] {
  const sufA = e.na === "m²" ? "m2" : "ha";
  const sufV = e.nv === "m³" ? "m3" : "hm3";
  return [
    {
      hoja: "Curva",
      encabezados: ["cota_m", `area_${sufA}`, `volumen_${sufV}`],
      filas: CURVA_EJEMPLO.map(([z, a, v]) => [numeroDeCelda(z), (numeroDeCelda(a) ?? 0) * e.a, (numeroDeCelda(v) ?? 0) * e.v]),
      formatos: ["0.00", e.da ? "0.0" : "0", e.dv ? "0.000" : "0"],
    },
  ];
}

function tablaResultados(pasos: PasoBalance[], paso: PasoTiempo, e: Escala): TablaSalida {
  const nv = e.nv === "m³" ? "m3" : "hm3";
  const na = e.na === "m²" ? "m2" : "ha";
  const v = (x: number) => x * e.v;
  return {
    hoja: "Balance",
    encabezados: [
      "fecha",
      "dias",
      `V_inicial_${nv}`,
      `area_${na}`,
      `aporte_${nv}`,
      `lluvia_${nv}`,
      `evaporacion_${nv}`,
      `infiltracion_${nv}`,
      `disponible_${nv}`,
      `qamb_exigido_${nv}`,
      `qamb_liberado_${nv}`,
      `demanda_${nv}`,
      `suministro_${nv}`,
      `vertido_${nv}`,
      `deficit_${nv}`,
      `salida_aguas_abajo_${nv}`,
      `V_final_${nv}`,
      "cota_final_m",
      "cumple_demanda",
      "cumple_qamb",
    ],
    filas: pasos.map((p) => [
      fechaUtc(p.fecha),
      p.duracionS / 86400,
      v(p.volumenInicialHm3),
      p.areaHa * e.a,
      v(p.aporteHm3),
      v(p.precipitacionHm3),
      v(p.evaporacionHm3),
      v(p.infiltracionHm3),
      v(p.disponibleHm3),
      v(p.qambExigidoHm3),
      v(p.qambLiberadoHm3),
      v(p.demandaHm3),
      v(p.suministroHm3),
      v(p.vertidoHm3),
      v(p.deficitHm3),
      v(p.salidaAguasAbajoHm3),
      v(p.volumenFinalHm3),
      p.cotaFinalM,
      p.cumpleDemanda ? 1 : 0,
      p.cumpleQamb ? 1 : 0,
    ]),
    formatos: [
      paso === "mensual" ? "yyyy-mm" : "yyyy-mm-dd",
      "0",
      ...Array(15).fill(e.dv ? "0.000000" : "0.0"),
      "0.000",
      "0",
      "0",
    ],
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

function siguienteFecha(filas: string[][], paso: PasoTiempo): string {
  const ultima = filas[filas.length - 1]?.[0];
  const m = ultima?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (paso === "mensual") d.setUTCMonth(d.getUTCMonth() + 1, 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Duración del paso de una fila, o null si la fecha no se puede leer. */
function duracionDeFila(fecha: string, paso: PasoTiempo): number | null {
  const f = fechaDeCelda(fecha);
  if (!f) return null;
  return duracionPasoS(`${f.anio}-${String(f.mes).padStart(2, "0")}-01`, paso);
}

/** Unidades de suelo de ejemplo (CRSU 1:1.000.000) con su agua disponible; reemplazar por las de la cuenca. */
const SUELOS_EJEMPLO: string[][] = [
  ["San Jacinto (SJc)", "5425", "83,1"],
  ["Chapicuy (Ch)", "1880", "100,1"],
  ["Tala-Rodríguez (Tl-Rd)", "7", "130,9"],
];

const COLUMNAS_SUELOS = [
  { titulo: "Unidad de suelo", texto: true },
  { titulo: "Área", sufijo: "ha" },
  { titulo: "AD", sufijo: "mm" },
];

const FACTORES_INICIALES = JSON.stringify(
  PERCENTILES.map((p) => FACTORES_PERCENTIL_S_SE[p].map((x) => textoNumero(x)))
);

export default function BalanceEmbalsePage() {
  const [pasoNombre, setPasoNombre] = useCampo("paso", "Paso mensual");
  const paso = NOMBRE_PASO[pasoNombre] ?? "mensual";
  const [serieMensual, setSerieMensual] = useTabla("serie-mensual", SERIE_EJEMPLO_MENSUAL);
  const [serieDiaria, setSerieDiaria] = useTabla("serie-diaria", SERIE_EJEMPLO_DIARIA);
  const filasSerie = paso === "mensual" ? serieMensual : serieDiaria;
  const setFilasSerie = paso === "mensual" ? setSerieMensual : setSerieDiaria;
  const [filasCurva, setFilasCurva] = useTabla("curva", CURVA_EJEMPLO);

  const [unidadVolNombre, setUnidadVolNombre] = useCampo("unidadVolumen", "hm³ y ha");
  const esc = escalaDe(unidadVolNombre);
  const [unidadCaudalNombre, setUnidadCaudalNombre] = useCampo(`unidadCaudal-${paso}`, "m³/s");
  const unidadCaudal: UnidadCaudalSerie = UNIDADES_CAUDAL[unidadCaudalNombre as NombreUnidadCaudal] ?? "m3s";

  const [limitesPor, setLimitesPor] = useCampo("limitesPor", "Volumen");
  const [vInicialTexto, setVInicial] = useCampo("vInicial", "15");
  const [vMinTexto, setVMin] = useCampo("vMin", "1,5");
  const [vMaxTexto, setVMax] = useCampo("vMax", "21,3");
  const [cotaMinTexto, setCotaMin] = useCampo("cotaMin", "314");
  const [cotaMaxTexto, setCotaMax] = useCampo("cotaMax", "322");
  const [infiltracionTexto, setInfiltracion] = useCampo("infiltracion", "0,05");
  const [coefEvapTexto, setCoefEvap] = useCampo("coefEvap", "1");
  const [areaEnNombre, setAreaEnNombre] = useCampo("areaEn", "Volumen medio del paso");

  // Caudal ambiental
  const [qambTipo, setQambTipo] = useCampo("qambTipo", "Constante");
  const [qambConstTexto, setQambConst] = useCampo("qambConst", "500");
  const [areaCuencaTexto, setAreaCuenca] = useCampo("areaCuenca", "73,1366");
  const [qMedio0, setQMedio0] = useCampo("qMedio0", "14,9");
  const [qMedio1, setQMedio1] = useCampo("qMedio1", "15,7");
  const [qMedio2, setQMedio2] = useCampo("qMedio2", "5,9");
  const [factoresJson, setFactoresJson] = useCampo("factores", FACTORES_INICIALES);
  const [percentil, setPercentil] = useCampo("percentil", "Q80");
  const [dicMarNombre, setDicMarNombre] = useCampo("dicMar", "No");
  const [modoLibNombre, setModoLibNombre] = useCampo("modoLiberacion", "mín(aporte; Qamb)");

  const [pasoDetalleTexto, setPasoDetalle] = useCampo("pasoDetalle", "1");

  // Aporte (serie o Témez) y demanda (serie o constante)
  const [aporteFuente, setAporteFuente] = useCampo("aporteFuente", "Serie cargada");
  const usaTemez = paso === "mensual" && aporteFuente === "Modelo de Témez";
  const [demandaModo, setDemandaModo] = useCampo("demandaModo", "De la serie");
  const demandaConstante = demandaModo === "Constante";
  const [demandaConstTexto, setDemandaConst] = useCampo(`demandaConst-${paso}`, paso === "mensual" ? "2" : "3");
  const [suelos, setSuelos] = useTabla("tzSuelos", SUELOS_EJEMPLO);
  const [tzCad, setTzCad] = useCampo("tzCad", "0,92");
  const [tzCpo, setTzCpo] = useCampo("tzCpo", "0,3");
  const [tzImax, setTzImax] = useCampo("tzImax", "386");
  const [tzAlfa, setTzAlfa] = useCampo("tzAlfa", "0,0775");
  const [tzH0, setTzH0] = useCampo("tzH0", "0");
  const [tzV0, setTzV0] = useCampo("tzV0", "0");
  const [tzDescontar, setTzDescontar] = useCampo("tzDescontar", "Sí");
  const [qAnualTexto, setQAnual] = useCampo("qMedioAnual", "12,2");
  const [anioHastaTexto, setAnioHasta] = useCampo("tzHasta", "2010");
  const requeridas: ColumnasRequeridas = { aporte: !usaTemez, demanda: !demandaConstante, etp: usaTemez };
  const especsSerieActual = especsSerie(requeridas);

  const factoresTexto: string[][] = useMemo(() => {
    try {
      const v = JSON.parse(factoresJson);
      if (Array.isArray(v) && v.length === 4) return v as string[][];
    } catch {
      // vuelve a los de la regionalización
    }
    return JSON.parse(FACTORES_INICIALES);
  }, [factoresJson]);
  const cambiarFactor = (i: number, j: number, t: string) => {
    const nuevo = factoresTexto.map((f) => [...f]);
    nuevo[i][j] = t;
    setFactoresJson(JSON.stringify(nuevo));
  };

  // ── Cambio de unidades: se reescala lo cargado para no cambiar su valor físico.
  const cambiarUnidadVolumen = (nombre: string) => {
    if (nombre === unidadVolNombre) return;
    const nueva = escalaDe(nombre);
    const fv = nueva.v / esc.v;
    const fa = nueva.a / esc.a;
    setVInicial(reescalar(vInicialTexto, fv));
    setVMin(reescalar(vMinTexto, fv));
    setVMax(reescalar(vMaxTexto, fv));
    setFilasCurva(filasCurva.map(([z, a, v]) => [z, reescalar(a ?? "", fa), reescalar(v ?? "", fv)]));
    setUnidadVolNombre(nombre);
  };

  const cambiarUnidadCaudal = (nombre: string) => {
    const nueva = UNIDADES_CAUDAL[nombre as NombreUnidadCaudal];
    if (!nueva || nueva === unidadCaudal) return;
    const de = unidadCaudal === "m3s" ? "m3s" : "m3";
    setFilasSerie(
      filasSerie.map((fila) => {
        const d = duracionDeFila(fila[0] ?? "", paso);
        if (d === null) return fila;
        const conv = (t: string) => {
          const n = numeroDeCelda(t);
          return n === null || Number.isNaN(n) ? t : textoNumero(convertirCaudalSerie(n, de, nueva, d), 6);
        };
        return [fila[0], conv(fila[1] ?? ""), fila[2], fila[3], conv(fila[4] ?? ""), fila[5] ?? ""];
      })
    );
    setUnidadCaudalNombre(nombre);
  };

  // ── Importaciones con unidad en el encabezado
  const importarSerie = (celdasArchivo: string[][], enc: Record<string, string>) => {
    const avisos: string[] = [];
    const celdas = celdasArchivo;
    // Datos diarios en una serie mensual: se agregan por mes (P suma; E y ETP promedio × días).
    if (paso === "mensual") {
      const meses = new Set(celdas.map((f) => (fechaDeCelda(f[0] ?? "") ? `${fechaDeCelda(f[0])!.anio}-${fechaDeCelda(f[0])!.mes}` : "")));
      if (meses.size > 0 && celdas.length > meses.size * 1.5) {
        const conv = (t: string, de: ReturnType<typeof unidadCaudalDeEncabezado>, d: number) => {
          const n = numeroDeCelda(t);
          if (!de || n === null || Number.isNaN(n)) return t;
          return textoNumero(convertirCaudalSerie(n, de, unidadCaudal, d), 6);
        };
        const diarias = celdas.map((f) => [
          f[0],
          conv(f[1], unidadCaudalDeEncabezado(enc.aporte ?? ""), 86400),
          f[2],
          f[3],
          conv(f[4], unidadCaudalDeEncabezado(enc.extraccion ?? ""), 86400),
          f[5] ?? "",
        ]);
        const ag = agregarDiarioAMensual(diarias, unidadCaudal);
        avisos.push(
          `El archivo trae datos diarios: se agregaron ${celdas.length} días en ${ag.filas.length} meses (lluvia sumada; evaporación y ETP como promedio del mes × días).`
        );
        if (ag.faltantes.length) {
          avisos.push(
            `${ag.faltantes.length} meses tienen días sin dato, p. ej. ${ag.faltantes
              .slice(0, 4)
              .map((f) => `${f.mes} (P ${f.p}, E ${f.e}, ETP ${f.etp})`)
              .join("; ")}. La lluvia de esos días no se rellena.`
          );
        }
        setFilasSerie(ag.filas);
        return { avisos };
      }
    }
    const destino = unidadCaudal;
    const unidades = { aporte: unidadCaudalDeEncabezado(enc.aporte ?? ""), extraccion: unidadCaudalDeEncabezado(enc.extraccion ?? "") };
    const convertidas = celdas.map((fila) => {
      const d = duracionDeFila(fila[0] ?? "", paso);
      const conv = (t: string, de: ReturnType<typeof unidadCaudalDeEncabezado>) => {
        const n = numeroDeCelda(t);
        if (!de || d === null || n === null || Number.isNaN(n)) return t;
        return textoNumero(convertirCaudalSerie(n, de, destino, d), 6);
      };
      return [fila[0], conv(fila[1], unidades.aporte), fila[2], fila[3], conv(fila[4], unidades.extraccion), fila[5] ?? ""];
    });
    const nombreUnidad = { m3s: "m³/s", ls: "L/s", m3: "m³ del paso", hm3: "hm³ del paso" } as const;
    for (const [col, u] of Object.entries(unidades)) {
      if ((col === "aporte" && !requeridas.aporte && !enc.aporte) || (col === "extraccion" && !requeridas.demanda && !enc.extraccion)) continue;
      const nombre = col === "aporte" ? "el aporte" : "la demanda";
      if (u && !(u === "m3s" && destino === "m3s") && !(u === "m3" && destino === "volumen")) {
        avisos.push(`Convertí ${nombre} de ${nombreUnidad[u]} a ${sufijoCaudal(destino, paso)}, según el encabezado.`);
      } else if (!u) {
        avisos.push(`El encabezado de ${nombre} no dice la unidad: se tomó como ${sufijoCaudal(destino, paso)}.`);
      }
    }
    setFilasSerie(convertidas);
    return { avisos };
  };

  const importarCurva = (celdas: string[][], enc: Record<string, string>) => {
    const avisos: string[] = [];
    const uA = unidadCurvaDeEncabezado(enc.areaHa ?? "");
    const uV = unidadCurvaDeEncabezado(enc.volumenHm3 ?? "");
    // Factor desde la unidad del archivo a la de pantalla.
    const fA = uA === "m2" ? esc.a / 1e4 : uA === "ha" ? esc.a : uA === "km2" ? esc.a * 100 : 1;
    const fV = uV === "m3" ? esc.v / 1e6 : uV === "hm3" ? esc.v : 1;
    if (uA && fA !== 1) avisos.push(`Convertí el área de ${uA === "m2" ? "m²" : uA === "km2" ? "km²" : "ha"} a ${esc.na}.`);
    if (uV && fV !== 1) avisos.push(`Convertí el volumen de ${uV === "m3" ? "m³" : "hm³"} a ${esc.nv}.`);
    if (!uA || !uV) avisos.push(`Sin unidad en el encabezado, el área y el volumen se tomaron en ${esc.na} y ${esc.nv}.`);
    setFilasCurva(celdas.map(([z, a, v]) => [z, reescalar(a, fA), reescalar(v, fV)]));
    return { avisos };
  };

  // ── Validación
  const validacionSerie = useMemo(
    () => validarSerie(filasSerie, paso, undefined, requeridas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filasSerie, paso, requeridas.aporte, requeridas.demanda, requeridas.etp]
  );
  const validacionCurvaPantalla = useMemo(() => validarCurva(filasCurva), [filasCurva]);
  const curva: PuntoCurva[] | null = useMemo(
    () =>
      validacionCurvaPantalla.curva?.map((p) => ({
        cotaM: p.cotaM,
        areaHa: p.areaHa / esc.a,
        volumenHm3: p.volumenHm3 / esc.v,
      })) ?? null,
    [validacionCurvaPantalla.curva, esc.a, esc.v]
  );

  const errores: string[] = [];
  const num = (t: string, nombre: string, minimo = 0) => {
    const v = aNumero(t);
    if (!Number.isFinite(v)) errores.push(`${nombre} no es un número.`);
    else if (v < minimo) errores.push(`${nombre} no puede ser menor que ${minimo}.`);
    return v;
  };

  const vInicial = num(vInicialTexto, "El volumen inicial") / esc.v;
  let vMin: number;
  let vMax: number;
  if (limitesPor === "Cota") {
    const zMin = num(cotaMinTexto, "La cota mínima de toma", -Infinity);
    const zMax = num(cotaMaxTexto, "La cota de vertido", -Infinity);
    vMin = curva ? volumenDeCota(curva, zMin) : NaN;
    vMax = curva ? volumenDeCota(curva, zMax) : NaN;
  } else {
    vMin = num(vMinTexto, "El volumen mínimo") / esc.v;
    vMax = num(vMaxTexto, "El volumen máximo") / esc.v;
  }
  const infiltracionM3s = num(infiltracionTexto, "La infiltración");
  const coefEvap = num(coefEvapTexto, "El coeficiente de evaporación");

  const areaKm2 = qambTipo === "Por percentil" || usaTemez ? num(areaCuencaTexto, "El área de la cuenca") : NaN;
  let qambPorMesM3s: number[] = Array(12).fill(NaN);
  if (qambTipo === "Por percentil") {
    const qm = [qMedio0, qMedio1, qMedio2].map((t, i) => num(t, `El q medio de ${CUATRIMESTRES[i]}`)) as [number, number, number];
    const factores = Object.fromEntries(
      PERCENTILES.map((p, i) => [p, factoresTexto[i].map((t, j) => num(t, `El factor ${p} de ${CUATRIMESTRES[j]}`)) as [number, number, number]])
    ) as Record<Percentil, [number, number, number]>;
    qambPorMesM3s = qambPorPercentil({
      areaCuencaKm2: areaKm2,
      qMedioLsKm2: qm,
      factores,
      percentil: (PERCENTILES as readonly string[]).includes(percentil) ? (percentil as Percentil) : "Q80",
      dicMarTodoElAnio: dicMarNombre === "Sí",
    });
  } else {
    qambPorMesM3s = Array(12).fill(num(qambConstTexto, "El caudal ambiental") / 1000);
  }

  if (errores.length === 0 && curva) {
    if (!(vMin < vMax)) errores.push("El volumen mínimo (toma) tiene que ser menor que el de vertido.");
    else if (vInicial < vMin || vInicial > vMax) errores.push("El volumen inicial tiene que estar entre el mínimo y el de vertido.");
  }

  const avisos: string[] = [];
  if (curva && errores.length === 0) {
    const ultimo = curva[curva.length - 1];
    if (vMax > ultimo.volumenHm3) {
      avisos.push(
        `El volumen de vertido supera el último punto de la curva: por encima se toman la cota y el área de ese punto. Extendé la curva.`
      );
    }
  }

  const demandaConst = demandaConstante ? num(demandaConstTexto, "La demanda constante") : NaN;

  // ── Témez: aporte de la cuenca desde P y ETP
  const erroresSuelos: string[] = [];
  let temez: PasoTemez[] | null = null;
  let areaEscurreM2 = NaN;
  let adPonderado = NaN;
  if (usaTemez) {
    const unidades = suelos
      .filter((f) => f.some((c) => (c ?? "").trim() !== ""))
      .map((f, i) => {
        const areaHa = numeroDeCelda(f[1] ?? "");
        const adMm = numeroDeCelda(f[2] ?? "");
        if (areaHa === null || Number.isNaN(areaHa) || areaHa <= 0) erroresSuelos.push(`Fila ${i + 1}: el área tiene que ser un número mayor que cero.`);
        if (adMm === null || Number.isNaN(adMm) || adMm <= 0) erroresSuelos.push(`Fila ${i + 1}: el AD tiene que ser un número mayor que cero.`);
        return { areaHa: areaHa ?? NaN, adMm: adMm ?? NaN };
      });
    if (unidades.length === 0) erroresSuelos.push("Cargá al menos una unidad de suelo con su AD.");
    adPonderado = erroresSuelos.length ? NaN : aguaDisponiblePonderada(unidades);
    const parametros = {
      aguaDisponibleMm: adPonderado,
      cad: num(tzCad, "El CAD de Témez"),
      cpo: num(tzCpo, "El CPo de Témez"),
      imaxMm: num(tzImax, "El Imax de Témez"),
      alfaDia: num(tzAlfa, "El α de Témez"),
      humedadInicialMm: num(tzH0, "La humedad inicial de Témez"),
      almacenamientoInicialMm: num(tzV0, "El almacenamiento inicial de Témez"),
    };
    const serieV = validacionSerie.serie;
    if (serieV && curva && erroresSuelos.length === 0 && errores.length === 0) {
      areaEscurreM2 = areaKm2 * 1e6 - (tzDescontar === "Sí" ? areaDeVolumen(curva, vMax) * 1e4 : 0);
      temez = calcularTemez(
        serieV.map((r) => ({
          fecha: r.fecha,
          dias: duracionPasoS(r.fecha, paso) / 86400,
          precipitacionMm: r.precipitacionMm,
          etpMm: r.etpMm ?? NaN,
        })),
        parametros
      );
    }
  }

  const serie: RegistroSerie[] | null =
    validacionSerie.serie && (!usaTemez || temez)
      ? validacionSerie.serie.map((r, i) => {
          const m3 = temez ? (temez[i].aporteMm / 1000) * areaEscurreM2 : NaN;
          return {
            ...r,
            aporte: temez ? (unidadCaudal === "m3s" ? m3 / duracionPasoS(r.fecha, paso) : m3) : r.aporte,
            extraccion: demandaConstante ? demandaConst : r.extraccion,
          };
        })
      : null;
  const datosBalance: DatosBalance | null =
    serie && curva && errores.length === 0 && erroresSuelos.length === 0
      ? {
          paso,
          serie,
          unidadCaudal,
          curva,
          qambPorMesM3s,
          modoLiberacion: modoLibNombre === "Qamb completo" ? "completo" : "minimo-aporte",
          infiltracionM3s,
          coefEvaporacion: coefEvap,
          areaEnPaso: areaEnNombre === "Volumen al inicio del paso" ? "inicio" : "medio",
          volumenInicialHm3: vInicial,
          volumenMinimoHm3: vMin,
          volumenMaximoHm3: vMax,
        }
      : null;
  const resultado = datosBalance ? calcularBalance(datosBalance) : null;

  const n = resultado?.pasos.length ?? 0;
  const pasoDetalle = Math.min(Math.max(1, Math.round(aNumero(pasoDetalleTexto)) || 1), Math.max(1, n));
  const detalle = resultado?.pasos[pasoDetalle - 1];

  const cotaVmin = curva ? cotaDeVolumen(curva, vMin) : NaN;
  const cotaVmax = curva ? cotaDeVolumen(curva, vMax) : NaN;
  const marcas = marcasTiempo(n);
  const unidadPaso = paso === "mensual" ? "meses" : "días";
  const V = (x: number, extra = 0) => `${fmt(x * esc.v, esc.dv + extra)} ${esc.nv}`;
  const pct = (x: number) => `${fmt(x * 100, 1)} %`;
  const sufCaudal = sufijoCaudal(unidadCaudal, paso);

  const todasColumnasSerie = [
    { titulo: "Fecha", ejemplo: "2024-01-01", texto: true },
    { titulo: "Aporte", sufijo: sufCaudal },
    { titulo: "Precipitación", sufijo: "mm" },
    { titulo: "Evaporación tanque", sufijo: "mm" },
    { titulo: "Demanda", sufijo: sufCaudal },
    { titulo: "ETP", sufijo: "mm" },
  ];
  const indicesSerie = [0, ...(usaTemez ? [] : [1]), 2, 3, ...(demandaConstante ? [] : [4]), ...(usaTemez ? [5] : [])];
  const columnasSerie = indicesSerie.map((i) => todasColumnasSerie[i]);
  const columnasCurva = [
    { titulo: "Cota", sufijo: "m" },
    { titulo: "Área", sufijo: esc.na },
    { titulo: "Volumen", sufijo: esc.nv },
  ];

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
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion
                id="unidadVolumen"
                etiqueta="Unidades de volumen y área"
                valor={escalaDe(unidadVolNombre).nv === "m³" ? "m³ y m²" : "hm³ y ha"}
                opciones={UNIDADES_VOLUMEN}
                onChange={cambiarUnidadVolumen}
              />
              <CampoSeleccion
                id="limitesPor"
                etiqueta="Límites del embalse por"
                valor={limitesPor === "Cota" ? "Cota" : "Volumen"}
                opciones={["Volumen", "Cota"]}
                onChange={setLimitesPor}
              />
            </div>
            {limitesPor === "Cota" ? (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="cotaMin" etiqueta="Cota mínima de toma" sufijo="m" valor={cotaMinTexto} onChange={setCotaMin} />
                <CampoNumerico id="cotaMax" etiqueta="Cota de vertido" sufijo="m" valor={cotaMaxTexto} onChange={setCotaMax} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="vMin" etiqueta="Volumen muerto (mín.)" sufijo={esc.nv} valor={vMinTexto} onChange={setVMin} />
                <CampoNumerico id="vMax" etiqueta="Volumen de vertido (máx.)" sufijo={esc.nv} valor={vMaxTexto} onChange={setVMax} />
              </div>
            )}
            {curva && Number.isFinite(vMin) && Number.isFinite(vMax) && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Volumen muerto {V(vMin)} a cota {fmt(cotaVmin, 2)} m; vertido {V(vMax)} a cota {fmt(cotaVmax, 2)} m; volumen
                útil {V(vMax - vMin)}.
              </p>
            )}
            <CampoNumerico
              id="vInicial"
              etiqueta="Volumen inicial"
              sufijo={esc.nv}
              valor={vInicialTexto}
              onChange={setVInicial}
              advertencia="Volumen almacenado al comienzo del primer paso."
            />
          </div>

          <div className="space-y-4">
            <p className="spec-label">Pérdidas</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="coefEvap"
                etiqueta="Coeficiente de tanque"
                valor={coefEvapTexto}
                onChange={setCoefEvap}
              />
              <CampoNumerico
                id="infiltracion"
                etiqueta="Infiltración"
                sufijo="m³/s"
                valor={infiltracionTexto}
                onChange={setInfiltracion}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Evaporación del lago = coeficiente × evaporación de tanque (0,7 es habitual para tanque A; 1 si la serie ya
              es evaporación de lago).
            </p>
            <CampoSeleccion
              id="areaEn"
              etiqueta="Área del espejo para lluvia y evaporación"
              valor={areaEnNombre === "Volumen al inicio del paso" ? "Volumen al inicio del paso" : "Volumen medio del paso"}
              opciones={["Volumen medio del paso", "Volumen al inicio del paso"]}
              onChange={setAreaEnNombre}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="spec-label">Curva cota-área-volumen</p>
          <BarraArchivos
            id="curva"
            especs={COLUMNAS_CURVA}
            onImportar={importarCurva}
            plantilla={() => plantillaCurva(esc)}
            nombrePlantilla="plantilla-curva-cota-area-volumen"
          />
          <TablaEditable
            id="tabla-curva"
            columnas={columnasCurva}
            filas={filasCurva}
            onChange={setFilasCurva}
            filasConError={filasDeErrores(validacionCurvaPantalla.errores)}
            porPagina={40}
          />
          <ListaErrores titulo="Errores en la curva" errores={validacionCurvaPantalla.errores} />
        </div>
      </div>

      <section className="space-y-4">
        <p className="spec-label">Caudal ambiental</p>
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion
                id="qambTipo"
                etiqueta="Criterio"
                valor={qambTipo === "Por percentil" ? "Por percentil" : "Constante"}
                opciones={["Constante", "Por percentil"]}
                onChange={setQambTipo}
              />
              {qambTipo === "Por percentil" ? (
                <CampoSeleccion
                  id="percentil"
                  etiqueta="Percentil de permanencia"
                  valor={percentil}
                  opciones={PERCENTILES}
                  onChange={setPercentil}
                />
              ) : (
                <CampoNumerico id="qambConst" etiqueta="Qamb" sufijo="L/s" valor={qambConstTexto} onChange={setQambConst} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion
                id="modoLiberacion"
                etiqueta="Qué se libera"
                valor={modoLibNombre === "Qamb completo" ? "Qamb completo" : "mín(aporte; Qamb)"}
                opciones={["mín(aporte; Qamb)", "Qamb completo"]}
                onChange={setModoLibNombre}
              />
              {qambTipo === "Por percentil" && (
                <CampoSeleccion
                  id="dicMar"
                  etiqueta="Qamb de DIC-MAR todo el año"
                  valor={dicMarNombre === "Sí" ? "Sí" : "No"}
                  opciones={["No", "Sí"]}
                  onChange={setDicMarNombre}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El caudal ambiental se libera antes que la demanda. Con «mín(aporte; Qamb)» nunca se suelta más de lo que entra
              en el paso (cuando el arroyo trae menos que el Qamb, pasa todo el aporte).
              {qambTipo === "Por percentil" &&
                " Q60: Decreto 368/018, art. 5. Q80: criterio básico de la guía de caudales ambientales."}
            </p>
          </div>

          {qambTipo === "Por percentil" && (
            <div className="space-y-3">
              <CampoNumerico
                id="areaCuenca"
                etiqueta="Área de la cuenca de aporte"
                sufijo="km²"
                valor={areaCuencaTexto}
                onChange={setAreaCuenca}
              />
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-medium" />
                      {CUATRIMESTRES.map((c) => (
                        <th key={c} scope="col" className="px-2 py-1.5 text-left font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/40">
                      <th scope="row" className="px-2 py-1 text-left text-xs font-normal text-muted-foreground">
                        q medio (L/s/km²)
                      </th>
                      {[
                        [qMedio0, setQMedio0],
                        [qMedio1, setQMedio1],
                        [qMedio2, setQMedio2],
                      ].map(([v, set], j) => (
                        <td key={j} className="px-0.5 py-0.5">
                          <input
                            aria-label={`q medio ${CUATRIMESTRES[j]}`}
                            inputMode="decimal"
                            value={v as string}
                            onChange={(e) => (set as (t: string) => void)(e.target.value)}
                            className="h-7 w-full rounded-sm border border-transparent bg-transparent px-1.5 font-mono text-[13px] tabular-nums outline-none hover:border-input focus:border-ring focus:bg-background"
                          />
                        </td>
                      ))}
                    </tr>
                    {PERCENTILES.map((p, i) => (
                      <tr key={p} className={`border-t border-border/40 ${p === percentil ? "bg-accent/60" : ""}`}>
                        <th scope="row" className="px-2 py-1 text-left text-xs font-normal text-muted-foreground">
                          Factor {p}
                        </th>
                        {CUATRIMESTRES.map((c, j) => (
                          <td key={c} className="px-0.5 py-0.5">
                            <input
                              aria-label={`Factor ${p} ${c}`}
                              inputMode="decimal"
                              value={factoresTexto[i]?.[j] ?? ""}
                              onChange={(e) => cambiarFactor(i, j, e.target.value)}
                              className="h-7 w-full rounded-sm border border-transparent bg-transparent px-1.5 font-mono text-[13px] tabular-nums outline-none hover:border-input focus:border-ring focus:bg-background"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Factores q(FF%)/q de la Regionalización de caudales (Dinagua, 2025), subregión Sur / Sureste, y q medio de
                ejemplo. Cargá los de tu cuenca nivel 2 y tu subregión.
              </p>
            </div>
          )}
        </div>

        {qambPorMesM3s.every(Number.isFinite) && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-right font-mono text-xs tabular-nums">
              <caption className="pb-1 text-left font-sans text-xs text-muted-foreground">
                Qamb exigido por mes{qambTipo === "Por percentil" ? ` (${percentil})` : ""}
              </caption>
              <thead className="font-sans text-[11px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-1.5 py-1 text-left font-medium">
                    L/s
                  </th>
                  {MESES.map((m) => (
                    <th key={m} scope="col" className="px-1.5 py-1 font-medium">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/40">
                  <td />
                  {qambPorMesM3s.map((q, i) => (
                    <td key={i} className="px-1.5 py-1" title={CUATRIMESTRES[cuatrimestreDeMes(i)]}>
                      {fmt(q * 1000, 1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <p className="spec-label">Aporte de la cuenca y demanda</p>
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion
                id="aporteFuente"
                etiqueta="Aporte de la cuenca"
                valor={usaTemez ? "Modelo de Témez" : "Serie cargada"}
                opciones={paso === "mensual" ? ["Serie cargada", "Modelo de Témez"] : ["Serie cargada"]}
                onChange={setAporteFuente}
              />
              <CampoSeleccion
                id="demandaModo"
                etiqueta="Demanda"
                valor={demandaConstante ? "Constante" : "De la serie"}
                opciones={["De la serie", "Constante"]}
                onChange={setDemandaModo}
              />
              {demandaConstante && (
                <CampoNumerico id="demandaConst" etiqueta="Demanda constante" sufijo={sufCaudal} valor={demandaConstTexto} onChange={setDemandaConst} />
              )}
              {usaTemez && (
                <CampoNumerico id="areaCuencaTz" etiqueta="Área de la cuenca" sufijo="km²" valor={areaCuencaTexto} onChange={setAreaCuenca} />
              )}
            </div>
            {paso === "diario" && aporteFuente === "Modelo de Témez" && (
              <p className="text-xs text-muted-foreground">El modelo de Témez es mensual: con paso diario se usa el aporte de la serie.</p>
            )}
            {usaTemez && (
              <>
                <p className="text-xs text-muted-foreground">
                  El aporte de cada mes sale de la precipitación y la ETP de la serie, sobre el área de la cuenca. Parámetros de partida
                  para Uruguay: Genta et al. (2001).
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <CampoNumerico id="tzCad" etiqueta="CAD" valor={tzCad} onChange={setTzCad} />
                  <CampoNumerico id="tzCpo" etiqueta="CPo" valor={tzCpo} onChange={setTzCpo} />
                  <CampoNumerico id="tzImax" etiqueta="Imax" sufijo="mm" valor={tzImax} onChange={setTzImax} />
                  <CampoNumerico id="tzAlfa" etiqueta="α" sufijo="1/día" valor={tzAlfa} onChange={setTzAlfa} />
                  <CampoNumerico id="tzH0" etiqueta="Humedad inicial H₀" sufijo="mm" valor={tzH0} onChange={setTzH0} />
                  <CampoNumerico id="tzV0" etiqueta="Almac. subt. V₀" sufijo="mm" valor={tzV0} onChange={setTzV0} />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-60">
                    <CampoSeleccion
                      id="tzDescontar"
                      etiqueta="Descontar el espejo del área que escurre"
                      valor={tzDescontar === "No" ? "No" : "Sí"}
                      opciones={["Sí", "No"]}
                      onChange={setTzDescontar}
                    />
                  </div>
                  {Number.isFinite(areaEscurreM2) && (
                    <p className="pb-2 text-xs text-muted-foreground">Área que escurre: {fmt(areaEscurreM2 / 1e6, 4)} km²</p>
                  )}
                </div>
                <button
                  type="button"
                  className={botonArchivo}
                  onClick={() => {
                    setTzCad(String(PARAMETROS_TEMEZ_URUGUAY.cad).replace(".", ","));
                    setTzCpo(String(PARAMETROS_TEMEZ_URUGUAY.cpo).replace(".", ","));
                    setTzImax(String(PARAMETROS_TEMEZ_URUGUAY.imaxMm));
                    setTzAlfa(String(PARAMETROS_TEMEZ_URUGUAY.alfaDia).replace(".", ","));
                  }}
                >
                  Volver a los parámetros de Genta et al. (2001)
                </button>
              </>
            )}
          </div>
          {usaTemez && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Agua disponible del suelo, ponderada por unidad</p>
              <TablaEditable id="tabla-suelos" columnas={COLUMNAS_SUELOS} filas={suelos} onChange={setSuelos} filaNueva={() => ["", "", ""]} />
              {erroresSuelos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  AD ponderado = Σ(Aᵢ·ADᵢ)/ΣAᵢ ={" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {fmt(adPonderado, 2)}{" "}
                    mm
                  </span>
                  ; Hmax = CAD · AD.
                </p>
              )}
              <ListaErrores titulo="Errores en las unidades de suelo" errores={erroresSuelos} />
              <div className="grid grid-cols-2 gap-3">
                <CampoNumerico
                  id="qMedioAnual"
                  etiqueta="q medio anual regional"
                  sufijo="L/s/km²"
                  valor={qAnualTexto}
                  onChange={setQAnual}
                  advertencia="Para validar Témez; por cuatrimestre usa los q medios del caudal ambiental."
                />
                <CampoNumerico id="tzHasta" etiqueta="Validar con meses hasta el año" valor={anioHastaTexto} onChange={setAnioHasta} advertencia="Período de la regionalización. Vacío: todos." />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="spec-label">Serie {paso === "mensual" ? "mensual" : "diaria"} de entradas y demanda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lluvia y evaporación de tanque como lámina en mm {paso === "mensual" ? "del mes" : "del día"}, aplicada sobre el
            área del espejo. Columnas del archivo: fecha, {usaTemez ? "" : "aporte, "}precipitacion_mm, evaporacion_mm
            {demandaConstante ? "" : ", demanda"}
            {usaTemez ? ", etp_mm" : ""}; la unidad de aporte y demanda se lee del encabezado (p. ej. aporte_m3s o aporte_m3_mes)
            y se convierte sola. Si el archivo trae datos diarios y el paso es mensual, se agregan por mes.
          </p>
        </div>
        <div className="w-48">
          <CampoSeleccion
            id="unidadCaudal"
            etiqueta="Aporte y demanda en"
            valor={unidadCaudal === "m3s" ? "m³/s" : "m³ en el paso"}
            opciones={Object.keys(UNIDADES_CAUDAL)}
            onChange={cambiarUnidadCaudal}
          />
        </div>
        <BarraArchivos
          id="serie"
          especs={especsSerieActual}
          onImportar={importarSerie}
          puntuar={(celdas) => validarSerie(celdas, paso, undefined, requeridas).errores.length}
          plantilla={() => plantillaSerie(paso, unidadCaudal)}
          nombrePlantilla={`plantilla-serie-${paso === "mensual" ? "mensual" : "diaria"}`}
        />
        <TablaEditable
          id="tabla-serie"
          columnas={columnasSerie}
          filas={filasSerie}
          onChange={setFilasSerie}
          filasConError={filasDeErrores(validacionSerie.errores)}
          porPagina={paso === "mensual" ? 24 : 31}
          filaNueva={(filas) => [siguienteFecha(filas, paso), "", "0", "0", "0", ""]}
          indices={indicesSerie}
        />
        <ListaErrores titulo="Errores en la serie" errores={validacionSerie.errores} />
      </section>

      <section className="space-y-6">
        <p className="spec-label">Resultados</p>
        <ListaErrores titulo="Revisá los datos" errores={errores} />
        <ListaAvisos avisos={avisos} />
        {!resultado ? (
          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Corregí los errores marcados para calcular el balance.
          </div>
        ) : (
          <>
            <PanelMetricas
              horizontal
              metricas={[
                {
                  etiqueta: "Garantía temporal",
                  valor: pct(resultado.garantiaTemporal),
                  nota: `${unidadPaso} con la demanda 100 % cubierta`,
                  destacada: true,
                },
                {
                  etiqueta: "Garantía volumétrica",
                  valor: pct(resultado.garantiaVolumetrica),
                  nota: "volumen suministrado / demandado",
                },
                {
                  etiqueta: "Pasos con falla",
                  valor: `${resultado.pasosConDeficit} de ${n}`,
                  nota: `racha máx. ${resultado.rachaMaximaFalla} · déficit máx. ${V(resultado.deficitMaximoHm3)}`,
                },
                {
                  etiqueta: "Cumplimiento del Qamb",
                  valor: pct(resultado.cumplimientoQamb),
                  nota: "salida aguas abajo ≥ Qamb exigido",
                },
                {
                  etiqueta: "Volumen mínimo",
                  valor: V(resultado.volumenMinimo.valorHm3),
                  nota: `${fechaCorta(resultado.volumenMinimo.fecha, paso)} · cota ${fmt(resultado.cotaMinimaM, 2)} m`,
                },
                {
                  etiqueta: "Volumen máximo",
                  valor: V(resultado.volumenMaximo.valorHm3),
                  nota: `${fechaCorta(resultado.volumenMaximo.fecha, paso)} · cota ${fmt(resultado.cotaMaximaM, 2)} m`,
                },
                {
                  etiqueta: "Pasos con vertido",
                  valor: `${resultado.pasosConVertido} de ${n}`,
                  nota: `vertido total ${V(resultado.vertidoTotalHm3)}`,
                },
                {
                  etiqueta: "Cierre del balance",
                  valor: V(resultado.cierreHm3, 3),
                  nota: "V₀ + entradas − salidas − V final",
                },
              ]}
            />

            {temez && (
              <PanelTemez
                pasos={temez}
                areaEscurreM2={areaEscurreM2}
                qRegional={
                  qambTipo === "Por percentil" || Number.isFinite(aNumero(qAnualTexto))
                    ? { anual: aNumero(qAnualTexto), cuatrimestres: [qMedio0, qMedio1, qMedio2].map(aNumero) }
                    : null
                }
                anioHasta={anioHastaTexto.trim() === "" ? null : aNumero(anioHastaTexto)}
                fechaCorta={(f) => fechaCorta(f, paso)}
              />
            )}

            <GraficoLineas
              titulo="Volumen almacenado al final de cada paso"
              series={[
                {
                  id: "volumen",
                  nombre: "Volumen",
                  color: "var(--serie-1)",
                  puntos: resultado.pasos.map((p, i) => ({ x: i, y: p.volumenFinalHm3 * esc.v })),
                },
              ]}
              referenciasY={[
                { y: vMax * esc.v, etiqueta: "Vertido (Vmáx)" },
                { y: vMin * esc.v, etiqueta: "Volumen muerto (Vmín)" },
              ]}
              formatoX={(i) => fechaCorta(resultado.pasos[Math.round(i)]?.fecha ?? "", paso)}
              formatoY={(y) => fmt(y, esc.dv ? 1 : 0)}
              formatoValor={(y) => `${fmt(y, esc.dv)} ${esc.nv}`}
              ejeX={paso === "mensual" ? "Mes" : "Día"}
              ejeY={`Volumen (${esc.nv})`}
              ticksX={marcas}
              desdeCero
              extraTooltip={(i) => {
                const p = resultado.pasos[Math.round(i)];
                if (!p) return [];
                return [
                  { etiqueta: "suministro", valor: V(p.suministroHm3) },
                  ...(p.vertidoHm3 > 0.5e-6 ? [{ etiqueta: "vertido", valor: V(p.vertidoHm3) }] : []),
                  ...(!p.cumpleDemanda ? [{ etiqueta: "déficit", valor: V(p.deficitHm3) }] : []),
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
                { y: cotaVmax, etiqueta: "Cota de vertido" },
                { y: cotaVmin, etiqueta: "Cota mínima de toma" },
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
                <p className="text-sm font-medium">Balance por paso ({esc.nv})</p>
                <div className="flex gap-1.5 print:hidden">
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() => descargarXlsx([tablaResultados(resultado.pasos, paso, esc)], "balance-embalse.xlsx")}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Exportar .xlsx
                  </button>
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() => descargarCsv(tablaResultados(resultado.pasos, paso, esc), "balance-embalse.csv")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar .csv
                  </button>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border/70 print:max-h-none">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="sticky top-0 bg-muted font-sans text-[11px] text-muted-foreground">
                    <tr>
                      {["#", "Fecha", "V inicial", `Área (${esc.na})`, "Aporte", "Lluvia", "Evap.", "Infiltr.", "Qamb exig.", "Qamb lib.", "Demanda", "Suministro", "Vertido", "Déficit", "V final", "Cota (m)"].map(
                        (t) => (
                          <th key={t} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">
                            {t}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.pasos.map((p) => {
                      const c = (x: number) => fmt(x * esc.v, esc.dv);
                      return (
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
                          <td className="px-2 py-1">{c(p.volumenInicialHm3)}</td>
                          <td className="px-2 py-1">{fmt(p.areaHa * esc.a, esc.da)}</td>
                          <td className="px-2 py-1">{c(p.aporteHm3)}</td>
                          <td className="px-2 py-1">{c(p.precipitacionHm3)}</td>
                          <td className="px-2 py-1">{c(p.evaporacionHm3)}</td>
                          <td className="px-2 py-1">{c(p.infiltracionHm3)}</td>
                          <td className="px-2 py-1">{c(p.qambExigidoHm3)}</td>
                          <td className={`px-2 py-1 ${p.cumpleQamb ? "" : "font-semibold text-destructive"}`}>{c(p.qambLiberadoHm3)}</td>
                          <td className="px-2 py-1">{c(p.demandaHm3)}</td>
                          <td className="px-2 py-1">{c(p.suministroHm3)}</td>
                          <td className={`px-2 py-1 ${p.vertidoHm3 > 0.5e-6 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {c(p.vertidoHm3)}
                          </td>
                          <td className={`px-2 py-1 ${!p.cumpleDemanda ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                            {c(p.deficitHm3)}
                          </td>
                          <td className="px-2 py-1 font-semibold">{c(p.volumenFinalHm3)}</td>
                          <td className="px-2 py-1">{fmt(p.cotaFinalM, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {n} {unidadPaso}. En rojo: Qamb liberado que no alcanza al exigido (salida aguas abajo menor que el Qamb) y
                déficit de demanda. Tocá el número de un paso para ver su cálculo.
              </p>
            </div>

            {detalle && curva && serie && (
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
                  filas={filasDetalle({
                    p: detalle,
                    curva,
                    vMin,
                    vMax,
                    reg: serie[detalle.indice],
                    temez: temez ? { paso: temez[detalle.indice], areaEscurreM2, hmax: aNumero(tzCad) * adPonderado, cpo: aNumero(tzCpo), imax: aNumero(tzImax), alfa: aNumero(tzAlfa), previo: detalle.indice > 0 ? temez[detalle.indice - 1] : null, h0: aNumero(tzH0), v0: aNumero(tzV0) } : null,
                    unidadCaudal,
                    qambM3s: qambPorMesM3s[Number(detalle.fecha.slice(5, 7)) - 1],
                    minimoAporte: modoLibNombre !== "Qamb completo",
                    infiltracionM3s,
                    coefEvap,
                    areaMedio: areaEnNombre !== "Volumen al inicio del paso",
                    paso,
                    esc,
                  })}
                />
              </div>
            )}
            {datosBalance && (
              <PanelSensibilidad
                datos={datosBalance}
                unidad={sufCaudal}
                V={(x) => V(x)}
                demandaActual={demandaConstante ? demandaConst : null}
                onUsarDemanda={(d) => {
                  setDemandaModo("Constante");
                  setDemandaConst(textoNumero(d, d >= 100 ? 0 : 4));
                }}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

function filasDetalle(o: {
  p: PasoBalance;
  curva: PuntoCurva[];
  vMin: number;
  vMax: number;
  reg: RegistroSerie;
  unidadCaudal: UnidadCaudalSerie;
  qambM3s: number;
  minimoAporte: boolean;
  infiltracionM3s: number;
  coefEvap: number;
  areaMedio: boolean;
  paso: PasoTiempo;
  esc: Escala;
  temez: {
    paso: PasoTemez;
    previo: PasoTemez | null;
    areaEscurreM2: number;
    hmax: number;
    cpo: number;
    imax: number;
    alfa: number;
    h0: number;
    v0: number;
  } | null;
}) {
  const { p, curva, esc } = o;
  const u = esc.nv;
  const V = (x: number) => fmt(x * esc.v, esc.dv + 1);
  const A = (x: number) => fmt(x * esc.a, esc.da + 1);
  const dt = p.duracionS;
  const dtTexto = fmt(dt, 0);
  const [a, b] = tramoCurva(curva, p.volumenAreaHm3);
  const [c, d] = tramoCurva(curva, p.volumenFinalHm3);
  // Lámina × área: con áreas en ha, 1 mm·ha = 10 m³; con m², 1 mm·m² = 0,001 m³.
  const factorLamina = esc.na === "m²" ? "/ 1000" : esc.nv === "hm³" ? "· 10⁻⁵" : "· 10";
  const volCaudal = (q: number) =>
    o.unidadCaudal === "m3s"
      ? { formula: `Q · Δt${esc.nv === "hm³" ? " / 10⁶" : ""}`, sust: `${fmt(q, 4)} · ${dtTexto}${esc.nv === "hm³" ? " / 10⁶" : ""}` }
      : { formula: `volumen del paso${esc.nv === "hm³" ? " / 10⁶" : ""}`, sust: `${fmt(q, 1)}${esc.nv === "hm³" ? " / 10⁶" : ""}` };
  const ap = volCaudal(o.reg.aporte);
  const de = volCaudal(o.reg.extraccion);

  const tz = o.temez;
  const filasTemez = tz
    ? (() => {
        const t = tz.paso;
        const hAnt = tz.previo ? tz.previo.humedad : tz.h0;
        const vAnt = tz.previo ? tz.previo.almacenamiento : tz.v0;
        const f2 = (x: number) => fmt(x, 2);
        return [
          { etiqueta: "Témez · Hmax", formula: "CAD · AD", valor: `${f2(tz.hmax)} mm` },
          { etiqueta: "Témez · δ", formula: "Hmax − H(i−1) + ETP", sustitucion: `${f2(tz.hmax)} − ${f2(hAnt)} + ${f2(t.etpMm)}`, valor: `${f2(t.delta)} mm` },
          { etiqueta: "Témez · P0", formula: "CPo · (Hmax − H(i−1))", sustitucion: `${fmt(tz.cpo, 3)} · (${f2(tz.hmax)} − ${f2(hAnt)})`, valor: `${f2(t.p0)} mm` },
          {
            etiqueta: "Témez · T",
            formula: "P ≤ P0 ? 0 : (P − P0)² / (P + δ − 2·P0)",
            sustitucion: t.precipitacionMm <= t.p0 ? `${f2(t.precipitacionMm)} ≤ ${f2(t.p0)}` : `(${f2(t.precipitacionMm)} − ${f2(t.p0)})² / (${f2(t.precipitacionMm)} + ${f2(t.delta)} − 2·${f2(t.p0)})`,
            valor: `${f2(t.excedente)} mm`,
          },
          { etiqueta: "Témez · H", formula: "máx(0; H(i−1) + P − T − ETP)", sustitucion: `máx(0; ${f2(hAnt)} + ${f2(t.precipitacionMm)} − ${f2(t.excedente)} − ${f2(t.etpMm)})`, valor: `${f2(t.humedad)} mm` },
          { etiqueta: "Témez · I", formula: "Imax · T / (T + Imax)", sustitucion: `${f2(tz.imax)} · ${f2(t.excedente)} / (${f2(t.excedente)} + ${f2(tz.imax)})`, valor: `${f2(t.infiltracion)} mm` },
          { etiqueta: "Témez · Asup", formula: "T − I", sustitucion: `${f2(t.excedente)} − ${f2(t.infiltracion)}`, valor: `${f2(t.escorrentiaSuperficial)} mm` },
          {
            etiqueta: "Témez · V",
            formula: "V(i−1)·e^(−α·d) + I·e^(−α·d/2)",
            sustitucion: `${f2(vAnt)}·e^(−${fmt(tz.alfa, 4)}·${t.dias}) + ${f2(t.infiltracion)}·e^(−${fmt(tz.alfa, 4)}·${t.dias}/2)`,
            valor: `${f2(t.almacenamiento)} mm`,
          },
          { etiqueta: "Témez · Asub", formula: "V(i−1) − V + I", sustitucion: `${f2(vAnt)} − ${f2(t.almacenamiento)} + ${f2(t.infiltracion)}`, valor: `${f2(t.escorrentiaSubterranea)} mm` },
          {
            etiqueta: "Témez · aporte",
            formula: "(Asup + Asub)/1000 · área que escurre",
            sustitucion: `(${f2(t.escorrentiaSuperficial)} + ${f2(t.escorrentiaSubterranea)})/1000 · ${fmt(tz.areaEscurreM2, 0)} m²`,
            valor: `${fmt((t.aporteMm / 1000) * tz.areaEscurreM2, 0)} m³`,
          },
        ];
      })()
    : [];

  return [
    ...filasTemez,
    {
      etiqueta: "Δt",
      formula: o.paso === "mensual" ? "días del mes · 86 400 s" : "1 día · 86 400 s",
      sustitucion: `${fmt(dt / 86400, 0)} · 86 400`,
      valor: `${dtTexto} s`,
    },
    { etiqueta: "Aporte", formula: ap.formula, sustitucion: ap.sust, valor: `${V(p.aporteHm3)} ${u}` },
    o.areaMedio
      ? {
          etiqueta: "V̄ (volumen medio)",
          formula: "(V_inicial + V_final) / 2",
          sustitucion: `(${V(p.volumenInicialHm3)} + ${V(p.volumenFinalHm3)}) / 2`,
          valor: `${V(p.volumenAreaHm3)} ${u}`,
        }
      : { etiqueta: "Área en el volumen inicial", valor: `${V(p.volumenAreaHm3)} ${u}` },
    {
      etiqueta: "A",
      formula: "A₁ + (V − V₁)·(A₂ − A₁)/(V₂ − V₁)",
      sustitucion: `${A(a.areaHa)} + (${V(p.volumenAreaHm3)} − ${V(a.volumenHm3)})·(${A(b.areaHa)} − ${A(a.areaHa)})/(${V(b.volumenHm3)} − ${V(a.volumenHm3)})`,
      valor: `${A(p.areaHa)} ${esc.na}${o.areaMedio ? `  (${p.iteraciones} iteraciones)` : ""}`,
    },
    {
      etiqueta: "Lluvia",
      formula: `P · A ${factorLamina}`,
      sustitucion: `${fmt(o.reg.precipitacionMm, 1)} · ${A(p.areaHa)} ${factorLamina}`,
      valor: `${V(p.precipitacionHm3)} ${u}`,
    },
    {
      etiqueta: "Evaporación",
      formula: `mín(E · k · A ${factorLamina}; V_ini + Aporte + Lluvia)`,
      sustitucion: `mín(${fmt(o.reg.evaporacionMm, 1)} · ${fmt(o.coefEvap, 2)} · ${A(p.areaHa)} ${factorLamina}; …)`,
      valor: `${V(p.evaporacionHm3)} ${u}`,
    },
    {
      etiqueta: "Infiltración",
      formula: `Q_inf · Δt${esc.nv === "hm³" ? " / 10⁶" : ""}`,
      sustitucion: `${fmt(o.infiltracionM3s, 3)} · ${dtTexto}${esc.nv === "hm³" ? " / 10⁶" : ""}`,
      valor: `${V(p.infiltracionHm3)} ${u}`,
    },
    {
      etiqueta: "W (disponible)",
      formula: "V_ini + Aporte + Lluvia − Evap − Infiltr",
      sustitucion: `${V(p.volumenInicialHm3)} + ${V(p.aporteHm3)} + ${V(p.precipitacionHm3)} − ${V(p.evaporacionHm3)} − ${V(p.infiltracionHm3)}`,
      valor: `${V(p.disponibleHm3)} ${u}`,
    },
    {
      etiqueta: "Qamb exigido",
      formula: `Qamb(mes) · Δt${esc.nv === "hm³" ? " / 10⁶" : ""}`,
      sustitucion: `${fmt(o.qambM3s * 1000, 2)} L/s · ${dtTexto} s / 1000${esc.nv === "hm³" ? " / 10⁶" : ""}`,
      valor: `${V(p.qambExigidoHm3)} ${u}`,
    },
    {
      etiqueta: "Qamb objetivo",
      formula: o.minimoAporte ? "mín(Qamb exigido; Aporte)" : "Qamb exigido",
      sustitucion: o.minimoAporte ? `mín(${V(p.qambExigidoHm3)}; ${V(p.aporteHm3)})` : V(p.qambExigidoHm3),
      valor: `${V(p.qambObjetivoHm3)} ${u}`,
    },
    {
      etiqueta: "Qamb liberado",
      formula: "mín(Qamb objetivo; W)",
      sustitucion: `mín(${V(p.qambObjetivoHm3)}; ${V(p.disponibleHm3)})`,
      valor: `${V(p.qambLiberadoHm3)} ${u}`,
    },
    { etiqueta: "Demanda", formula: de.formula, sustitucion: de.sust, valor: `${V(p.demandaHm3)} ${u}` },
    {
      etiqueta: "Suministro",
      formula: "máx(0; mín(Demanda; W − Qamb lib − V_mín))",
      sustitucion: `máx(0; mín(${V(p.demandaHm3)}; ${V(p.disponibleHm3)} − ${V(p.qambLiberadoHm3)} − ${V(o.vMin)}))`,
      valor: `${V(p.suministroHm3)} ${u}`,
    },
    {
      etiqueta: "Vertido",
      formula: "máx(0; W − Qamb lib − Suministro − V_máx)",
      sustitucion: `máx(0; ${V(p.disponibleHm3)} − ${V(p.qambLiberadoHm3)} − ${V(p.suministroHm3)} − ${V(o.vMax)})`,
      valor: `${V(p.vertidoHm3)} ${u}`,
    },
    {
      etiqueta: "V_final",
      formula: "W − Qamb lib − Suministro − Vertido",
      sustitucion: `${V(p.disponibleHm3)} − ${V(p.qambLiberadoHm3)} − ${V(p.suministroHm3)} − ${V(p.vertidoHm3)}`,
      valor: `${V(p.volumenFinalHm3)} ${u}`,
    },
    {
      etiqueta: "Déficit",
      formula: "Demanda − Suministro",
      sustitucion: `${V(p.demandaHm3)} − ${V(p.suministroHm3)}`,
      valor: `${V(p.deficitHm3)} ${u}`,
    },
    {
      etiqueta: "Cumple Qamb",
      formula: "Qamb lib + Vertido ≥ Qamb exigido",
      sustitucion: `${V(p.qambLiberadoHm3)} + ${V(p.vertidoHm3)} ≥ ${V(p.qambExigidoHm3)}`,
      valor: p.cumpleQamb ? "sí" : "no",
    },
    {
      etiqueta: "Cota final",
      formula: "z₁ + (V_final − V₁)·(z₂ − z₁)/(V₂ − V₁)",
      sustitucion: `${fmt(c.cotaM, 2)} + (${V(p.volumenFinalHm3)} − ${V(c.volumenHm3)})·(${fmt(d.cotaM, 2)} − ${fmt(c.cotaM, 2)})/(${V(d.volumenHm3)} − ${V(c.volumenHm3)})`,
      valor: `${fmt(p.cotaFinalM, 3)} m`,
    },
  ];
}
