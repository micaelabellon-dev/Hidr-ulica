"use client";

import { useMemo, useRef } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas, type SerieGrafico } from "@/components/calculadoras/graficos/GraficoLineas";
import { BarrasHietograma } from "@/components/calculadoras/graficos/BarrasHietograma";
import { DiagramaMce } from "@/components/calculadoras/croquis/DiagramaMce";
import {
  aGrillaMinuto,
  almacenamientoMaximo,
  bloquesAlternos,
  calcularMce,
  coeficientes,
  COLUMNAS_TORMENTAS,
  horaSwmm,
  leerSalidaSwmm,
  pico,
  qRacionalMontana,
  serieSwmm,
  tcDesbordesMin,
  tcFaaH,
  tcKirpichH,
  TORMENTAS_EJEMPLO,
  validarTormentas,
  volumen,
  volumenSobre,
  type Escenario,
} from "@/lib/calc/hidraulica/mce";
import { descargarCsv, descargarXlsx, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("mce-amortiguacion");

const METODOS_TC = ["Desbordes", "Kirpich", "FAA", "Manual"] as const;
const FUENTES = ["Tabla (pegada o importada)", "Rodríguez Fontal (bloques alternos)"] as const;
const NOMBRE_ESC: Record<Escenario, string> = {
  proyecto: "Proyecto",
  previa: "Situación previa (FIS)",
  amortiguada: "Área al amortiguador",
  sinAmortiguar: "Área sin amortiguar",
};
const FILA_VACIA = () => ["", "", ""];

function descargarTexto(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const q3 = (q: number) => fmt(q, q < 0.01 ? 5 : 4);

export default function MceAmortiguacionPage() {
  // Predio
  const [aCatTxt, setACat] = useCampo("aCat", "30350");
  const [aEitTxt, setAEit] = useCampo("aEit", "30872");
  const [aLibreTxt, setALibre] = useCampo("aLibre", "29728");
  const [aImpTxt, setAImp] = useCampo("aImp", "13554");
  const [cImpTxt, setCImp] = useCampo("cImp", "0,83");
  const [cPermTxt, setCPerm] = useCampo("cPerm", "0,37");
  const [aImpPrevTxt, setAImpPrev] = useCampo("aImpPrev", "5700");
  const [porcMaxTxt, setPorcMax] = useCampo("porcMax", "32");
  const [aAmortTxt, setAAmort] = useCampo("aAmort", "29885");
  const [aImpSinTxt, setAImpSin] = useCampo("aImpSin", "0");
  // Tc
  const [lTxt, setL] = useCampo("l", "306");
  const [zAltaTxt, setZAlta] = useCampo("zAlta", "43");
  const [zBajaTxt, setZBaja] = useCampo("zBaja", "33");
  const [metodoTc, setMetodoTc] = useCampo("metodoTc", "Desbordes");
  const [tcManualTxt, setTcManual] = useCampo("tcManual", "10");
  const [tcMinTxt, setTcMin] = useCampo("tcMin", "10");
  // HU
  const [dTxt, setD] = useCampo("d", "5");
  const [kTpTxt, setKTp] = useCampo("kTp", "1,5");
  const [kTbTxt, setKTb] = useCampo("kTb", "1,5");
  // Tormentas
  const [fuente, setFuente] = useCampo("fuente", FUENTES[0]);
  const [tr1Txt, setTr1] = useCampo("tr1", "2");
  const [tr2Txt, setTr2] = useCampo("tr2", "10");
  const [tr3Txt, setTr3] = useCampo("tr3", "20");
  const [tormentasTabla, setTormentasTabla] = useTabla("tormentas", TORMENTAS_EJEMPLO);
  const [p310Txt, setP310] = useCampo("p310", "85");
  const [durTxt, setDur] = useCampo("dur", "360");
  const [posPicoTxt, setPosPico] = useCampo("posPico", "16");
  const [trDisenoNombre, setTrDiseno] = useCampo("trDiseno", "TR 10 años");
  // Referencia Montana
  const [montAtxt, setMontA] = useCampo("montA", "7,84");
  const [montBtxt, setMontB] = useCampo("montB", "0,52");
  // SWMM
  const [swmmTxt, setSwmm] = useCampo("swmm", "");
  const archivoSwmm = useRef<HTMLInputElement>(null);

  const errores: string[] = [];
  const num = (t: string, nombre: string, min = 0, estricto = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (estricto ? v <= min : v < min)) errores.push(`${nombre}: tiene que ser un número ${estricto ? ">" : "≥"} ${min}.`);
    return v;
  };
  const aCat = num(aCatTxt, "Área catastral");
  const aEit = num(aEitTxt, "Área EIT");
  const aLibre = num(aLibreTxt, "Área libre de afectaciones");
  const aImp = num(aImpTxt, "Área impermeable del proyecto", 0, false);
  const cImp = num(cImpTxt, "C impermeable");
  const cPerm = num(cPermTxt, "C permeable");
  const aImpPrev = num(aImpPrevTxt, "Área impermeable previa", 0, false);
  const porcMax = num(porcMaxTxt, "% impermeable máximo", 0, false);
  const aAmort = num(aAmortTxt, "Área al amortiguador");
  const aImpSin = num(aImpSinTxt, "Área impermeable sin amortiguar", 0, false);
  const lM = num(lTxt, "Longitud del recorrido");
  const zAlta = aNumero(zAltaTxt);
  const zBaja = aNumero(zBajaTxt);
  const tcManual = num(tcManualTxt, "Tc manual");
  const tcMin = num(tcMinTxt, "Tc mínimo", 0, false);
  const dMin = num(dTxt, "Intervalo D");
  const kTp = num(kTpTxt, "Coeficiente de Tp");
  const kTb = num(kTbTxt, "Coeficiente de Tb", 1);
  const trs = [aNumero(tr1Txt), aNumero(tr2Txt), aNumero(tr3Txt)];
  const montA = aNumero(montAtxt);
  const montB = aNumero(montBtxt);
  if (cImp > 1 || cPerm > 1) errores.push("Los coeficientes de escorrentía van entre 0 y 1.");
  if (!(zAlta > zBaja)) errores.push("La cota alta tiene que ser mayor que la baja.");
  if (aImp > aEit) errores.push("El área impermeable del proyecto supera el área EIT.");
  if (aAmort > aCat) errores.push("El área al amortiguador supera el área catastral.");

  const generar = fuente === FUENTES[1];
  const p310 = aNumero(p310Txt);
  const durMin = aNumero(durTxt);
  const posPico = aNumero(posPicoTxt);
  if (generar) {
    if (!(p310 > 0)) errores.push("P(3,10) tiene que ser mayor que cero.");
    if (!(durMin >= dMin)) errores.push("La duración de la tormenta tiene que ser al menos un intervalo D.");
    if (!(posPico >= 0 && posPico <= 100)) errores.push("La posición del pico va entre 0 y 100 %.");
    trs.forEach((T, i) => {
      if (!(T > 1)) errores.push(`TR de la tormenta ${i + 1}: tiene que ser mayor que 1 año.`);
    });
  }

  const validacion = useMemo(() => validarTormentas(tormentasTabla), [tormentasTabla]);
  const ok = errores.length === 0;
  const coef = ok
    ? coeficientes({
        areaCatastralM2: aCat,
        areaEitM2: aEit,
        areaLibreM2: aLibre,
        areaImpProyectoM2: aImp,
        areaImpPreviaM2: aImpPrev,
        porcImpMaxPrevia: porcMax,
        cImp,
        cPerm,
        areaAmortM2: aAmort,
        areaImpSinAmortM2: aImpSin,
      })
    : null;

  // Tiempo de concentración
  const sMm = ok ? (zAlta - zBaja) / lM : NaN;
  const tcs = coef
    ? {
        kirpich: tcKirpichH(lM / 1000, sMm) * 60,
        desbordesProy: tcDesbordesMin(coef.proyecto.areaM2 / 10_000, sMm * 100, coef.proyecto.c),
        desbordesPrev: tcDesbordesMin(coef.previa.areaM2 / 10_000, sMm * 100, cPerm),
        faaProy: tcFaaH(lM, sMm * 100, coef.proyecto.c) * 60,
        faaPrev: tcFaaH(lM, sMm * 100, cPerm) * 60,
      }
    : null;
  const tcCalc = (proy: boolean) =>
    !tcs
      ? NaN
      : metodoTc === "Kirpich"
        ? tcs.kirpich
        : metodoTc === "FAA"
          ? proy
            ? tcs.faaProy
            : tcs.faaPrev
          : metodoTc === "Manual"
            ? tcManual
            : proy
              ? tcs.desbordesProy
              : tcs.desbordesPrev;
  const tcProyMin = Math.max(tcCalc(true), tcMin);
  const tcPrevMin = Math.max(tcCalc(false), tcMin);

  // Tormentas
  const tormentas: (number[] | null)[] = !generar
    ? validacion.tormentas
    : ok
      ? trs.map((T) => bloquesAlternos(p310, T, aEit / 1e6, durMin, dMin, posPico / 100))
      : [null, null, null];
  const erroresTormenta = generar ? [] : validacion.errores;
  const etiquetas = trs.map((T, i) => (Number.isFinite(T) ? `TR ${fmt(T, T % 1 ? 1 : 0)} años` : `Tormenta ${i + 1}`));
  const disponibles = tormentas.map((t, i) => (t && t.length > 0 ? i : -1)).filter((i) => i >= 0);
  const opcionesTr = disponibles.map((i) => etiquetas[i]);
  const kDis = disponibles[Math.max(0, opcionesTr.indexOf(trDisenoNombre))] ?? disponibles[0] ?? -1;

  const r =
    coef && erroresTormenta.length === 0 && disponibles.length > 0 && tcProyMin > 0 && tcPrevMin > 0
      ? calcularMce(
          coef,
          tcProyMin / 60,
          tcPrevMin / 60,
          { dMin, kTp, kTb },
          tormentas.map((t) => t ?? [])
        )
      : null;

  // Salida de SWMM
  const swmm = useMemo(() => (swmmTxt.trim() ? leerSalidaSwmm(swmmTxt) : null), [swmmTxt]);
  const post =
    r && swmm && swmm.errores.length === 0 && kDis >= 0
      ? (() => {
          const salida = aGrillaMinuto(swmm.tH, swmm.q, r.minutos);
          const total = salida.map((v, i) => v + r.q.sinAmortiguar[kDis][i]);
          return {
            salida,
            total,
            picoSalida: pico(salida),
            picoTotal: pico(total),
            almacen: almacenamientoMaximo(r.q.amortiguada[kDis], salida),
            fuera: swmm.tH[swmm.tH.length - 1] * 60 > r.minutos + 0.5,
          };
        })()
      : null;

  const avisos: string[] = [];
  if (coef && coef.porcImpPrevia < (aImpPrev / aLibre) * 100 - 1e-9)
    avisos.push(`El área impermeable previa se limitó al ${fmt(porcMax, 0)} % del área libre (${fmt(coef.areaImpPreviaM2, 0)} m²).`);
  if (tcs && tcCalc(true) < tcMin) avisos.push(`El Tc calculado (${fmt(tcCalc(true), 2)} min) es menor que el mínimo: se adopta ${fmt(tcMin, 0)} min.`);
  if (kTp < 0.6 || kTb < 1.5) avisos.push("Con Tp = D/2 + 0,6·Tc y Tb = 2,67·Tp se tiene el hidrograma triangular del SCS; revisá los coeficientes.");
  if (r && kDis >= 0) {
    const ultimo = r.q.proyecto[kDis][r.minutos];
    if (ultimo > 0.05 * r.picos.proyecto[kDis].q) avisos.push("El hidrograma no termina de bajar dentro del horizonte calculado.");
  }
  if (swmm) avisos.push(...swmm.avisos);
  if (post?.fuera) avisos.push("La salida de SWMM dura más que el horizonte de cálculo; se recorta.");

  // Exportación
  const tablaHidrogramas = (): TablaSalida => ({
    hoja: "Hidrogramas",
    encabezados: [
      "t_h",
      "t_swmm",
      ...disponibles.flatMap((k) => [
        `q_proyecto_${etiquetas[k]}`,
        `q_previa_${etiquetas[k]}`,
        `q_amortiguador_${etiquetas[k]}`,
        `q_sin_amortiguar_${etiquetas[k]}`,
      ]),
      ...(post ? ["q_salida_swmm", "q_total_con_mce"] : []),
    ],
    filas: r
      ? Array.from({ length: r.minutos + 1 }, (_, m) => [
          m / 60,
          horaSwmm(m),
          ...disponibles.flatMap((k) => [r.q.proyecto[k][m], r.q.previa[k][m], r.q.amortiguada[k][m], r.q.sinAmortiguar[k][m]]),
          ...(post ? [post.salida[m], post.total[m]] : []),
        ])
      : [],
  });
  const tablaTormentas = (): TablaSalida => ({
    hoja: "Tormentas",
    encabezados: ["t_ini_min", "t_swmm", ...disponibles.map((k) => `i_mm_h_${etiquetas[k]}`)],
    filas: Array.from({ length: Math.max(0, ...disponibles.map((k) => tormentas[k]!.length)) }, (_, j) => [
      j * dMin,
      horaSwmm(j * dMin),
      ...disponibles.map((k) => tormentas[k]![j] ?? 0),
    ]),
  });

  const minutosGrafico = r ? Math.min(r.minutos, Math.max(120, Math.ceil((r.picos.proyecto[kDis]?.tH ?? 1) * 60 * 3))) : 0;
  const serie = (q: readonly number[]) => Array.from({ length: minutosGrafico + 1 }, (_, m) => ({ x: m / 60, y: q[m] }));
  const series: SerieGrafico[] =
    r && kDis >= 0
      ? [
          { id: "proy", nombre: "Proyecto sin MCE", color: "var(--serie-2)", puntos: serie(r.q.proyecto[kDis]) },
          { id: "prev", nombre: "Situación previa", color: "var(--serie-1)", puntos: serie(r.q.previa[kDis]) },
          ...(post ? [{ id: "mce", nombre: "Proyecto con MCE (SWMM + sin amortiguar)", color: "var(--serie-3)", puntos: serie(post.total) }] : []),
        ]
      : [];

  const leerArchivo = async (f: File) => setSwmm(await f.text());

  const picoProy = r && kDis >= 0 ? r.picos.proyecto[kDis] : null;
  const picoPrev = r && kDis >= 0 ? r.picos.previa[kDis] : null;
  const cumple = post && picoPrev ? post.picoTotal.q <= picoPrev.q : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={[]} metodo="" onMetodoChange={() => {}} />
      </div>

      <p className="-mt-4 max-w-3xl text-sm text-muted-foreground">
        Antes de SWMM: coeficientes, tiempo de concentración y los hidrogramas de proyecto, situación previa y de cada área, listos para
        bajar como serie de tiempo. Después de SWMM: pegá la salida del amortiguador y se suma al área sin amortiguar para comparar con el
        pico previo.
      </p>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Predio</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CampoNumerico id="aCat" etiqueta="Área catastral" sufijo="m²" valor={aCatTxt} onChange={setACat} />
              <CampoNumerico id="aEit" etiqueta="Área EIT" sufijo="m²" valor={aEitTxt} onChange={setAEit} />
              <CampoNumerico id="aLibre" etiqueta="Área libre de afect." sufijo="m²" valor={aLibreTxt} onChange={setALibre} />
              <CampoNumerico id="aImp" etiqueta="Área imp. proyecto" sufijo="m²" valor={aImpTxt} onChange={setAImp} />
              <CampoNumerico id="cImp" etiqueta="C impermeable" valor={cImpTxt} onChange={setCImp} />
              <CampoNumerico id="cPerm" etiqueta="C permeable" valor={cPermTxt} onChange={setCPerm} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Situación previa (FIS)</p>
            <div className="grid grid-cols-2 gap-3">
              <CampoNumerico id="aImpPrev" etiqueta="Área imp. previa" sufijo="m²" valor={aImpPrevTxt} onChange={setAImpPrev} />
              <CampoNumerico id="porcMax" etiqueta="% imp. máximo admitido" sufijo="%" valor={porcMaxTxt} onChange={setPorcMax} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Subcuencas</p>
            <div className="grid grid-cols-2 gap-3">
              <CampoNumerico id="aAmort" etiqueta="Área al amortiguador" sufijo="m²" valor={aAmortTxt} onChange={setAAmort} />
              <CampoNumerico id="aImpSin" etiqueta="Área imp. sin amortiguar" sufijo="m²" valor={aImpSinTxt} onChange={setAImpSin} />
            </div>
            <p className="text-xs text-muted-foreground">
              El área sin amortiguar es la catastral menos la que va al amortiguador. Las dos se corrigen por A<sub>EIT</sub> / A
              <sub>catastral</sub>; el área impermeable del proyecto se asigna toda al amortiguador.
            </p>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Tiempo de concentración</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="l" etiqueta="Recorrido L" sufijo="m" valor={lTxt} onChange={setL} />
              <CampoNumerico id="zAlta" etiqueta="Cota alta" sufijo="m" valor={zAltaTxt} onChange={setZAlta} />
              <CampoNumerico id="zBaja" etiqueta="Cota baja" sufijo="m" valor={zBajaTxt} onChange={setZBaja} />
              <CampoSeleccion id="metodoTc" etiqueta="Método" valor={metodoTc} opciones={METODOS_TC} onChange={setMetodoTc} />
              {metodoTc === "Manual" && <CampoNumerico id="tcManual" etiqueta="Tc" sufijo="min" valor={tcManualTxt} onChange={setTcManual} />}
              <CampoNumerico id="tcMin" etiqueta="Tc mínimo" sufijo="min" valor={tcMinTxt} onChange={setTcMin} />
            </div>
            {tcs && (
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-medium">
                        Tc (min)
                      </th>
                      <th scope="col" className="px-2 py-1.5 font-medium">Kirpich</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">Desbordes</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">FAA</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">Adoptado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Proyecto", tcs.desbordesProy, tcs.faaProy, tcProyMin],
                        ["Previa", tcs.desbordesPrev, tcs.faaPrev, tcPrevMin],
                      ] as const
                    ).map(([e, d, f, a]) => (
                      <tr key={e} className="border-t border-border/40">
                        <td className="px-2 py-1 text-left font-sans">{e}</td>
                        <td className="px-2 py-1">{fmt(tcs.kirpich, 2)}</td>
                        <td className="px-2 py-1">{fmt(d, 2)}</td>
                        <td className="px-2 py-1">{fmt(f, 2)}</td>
                        <td className="px-2 py-1 font-semibold">{fmt(a, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Hidrograma unitario triangular</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="d" etiqueta="Intervalo D" sufijo="min" valor={dTxt} onChange={setD} />
              <CampoNumerico id="kTp" etiqueta="Tp = D/2 + k·Tc" sufijo="k" valor={kTpTxt} onChange={setKTp} />
              <CampoNumerico id="kTb" etiqueta="Tb = k·Tp" sufijo="k" valor={kTbTxt} onChange={setKTb} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Tormentas de diseño</p>
            <div className="grid grid-cols-2 gap-3">
              <CampoSeleccion id="fuente" etiqueta="Tormentas" valor={fuente} opciones={FUENTES} onChange={setFuente} />
              {opcionesTr.length > 0 && (
                <CampoSeleccion
                  id="trDiseno"
                  etiqueta="Tormenta de diseño"
                  valor={etiquetas[kDis] ?? opcionesTr[0]}
                  opciones={opcionesTr}
                  onChange={setTrDiseno}
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="tr1" etiqueta="TR columna 1" sufijo="años" valor={tr1Txt} onChange={setTr1} />
              <CampoNumerico id="tr2" etiqueta="TR columna 2" sufijo="años" valor={tr2Txt} onChange={setTr2} />
              <CampoNumerico id="tr3" etiqueta="TR columna 3" sufijo="años" valor={tr3Txt} onChange={setTr3} />
            </div>
            {generar ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <CampoNumerico id="p310" etiqueta="P(3,10)" sufijo="mm" valor={p310Txt} onChange={setP310} />
                  <CampoNumerico id="dur" etiqueta="Duración" sufijo="min" valor={durTxt} onChange={setDur} />
                  <CampoNumerico id="posPico" etiqueta="Posición del pico" sufijo="%" valor={posPicoTxt} onChange={setPosPico} />
                </div>
                <p className="text-xs text-muted-foreground">
                  P(d,T,A) = P(3,10)·CT·CD·CA con el área EIT; los incrementos de cada intervalo se ordenan alrededor del pico.
                </p>
              </>
            ) : (
              <>
                <BarraArchivos
                  id="tormentas"
                  especs={COLUMNAS_TORMENTAS}
                  onImportar={(celdas) => setTormentasTabla(celdas.map((f) => [f[0] ?? "", f[1] ?? "", f[2] ?? ""]))}
                  plantilla={() => [tablaTormentas()]}
                  nombrePlantilla="tormentas-mce"
                />
                <TablaEditable
                  id="tabla-tormentas"
                  columnas={[0, 1, 2].map((k) => ({ titulo: etiquetas[k], sufijo: "mm/h" }))}
                  filas={tormentasTabla}
                  onChange={setTormentasTabla}
                  filasConError={filasDeErrores(validacion.errores)}
                  filaNueva={FILA_VACIA}
                  porPagina={12}
                />
                <ListaErrores titulo="Errores en las tormentas" errores={validacion.errores} />
                <p className="text-xs text-muted-foreground">
                  Intensidad media de cada intervalo D, en mm/h (el primero empieza en t = 0). Dejá vacía una columna para no usarla.
                </p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Referencia: método racional (Montana)</p>
            <div className="grid grid-cols-2 gap-3">
              <CampoNumerico id="montA" etiqueta="i = a·t^−b: a" sufijo="mm/min" valor={montAtxt} onChange={setMontA} />
              <CampoNumerico id="montB" etiqueta="b" valor={montBtxt} onChange={setMontB} />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          <ListaAvisos avisos={avisos} />
          {r && coef && picoProy && picoPrev && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: `Pico proyecto · ${etiquetas[kDis]}`, valor: q3(picoProy.q), nota: `m³/s a las ${horaSwmm(picoProy.tH * 60)} h` },
                  { etiqueta: "Pico situación previa", valor: q3(picoPrev.q), nota: "m³/s (máximo admisible)", destacada: true },
                  { etiqueta: "Caudal a amortiguar", valor: q3(Math.max(0, picoProy.q - picoPrev.q)), nota: "m³/s" },
                  {
                    etiqueta: "Volumen sobre el pico previo",
                    valor: fmt(volumenSobre(r.q.proyecto[kDis], picoPrev.q), 1),
                    nota: "m³ (mínimo, sin laminar)",
                  },
                ]}
              />

              <DiagramaMce
                areaAmortM2={coef.amortiguada.areaM2}
                areaImpM2={coef.amortiguada.areaImpM2}
                areaSinAmortM2={coef.sinAmortiguar.areaM2}
                qEntradaM3s={r.picos.amortiguada[kDis].q}
                qPreviaM3s={picoPrev.q}
                qSalidaM3s={post ? post.picoSalida.q : null}
                qSinAmortM3s={r.picos.sinAmortiguar[kDis].q}
                qTotalM3s={post ? post.picoTotal.q : null}
                trEtiqueta={etiquetas[kDis]}
              />

              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-medium">
                        Subcuenca
                      </th>
                      <th scope="col" className="px-2 py-1.5 font-medium">A (m²)</th>
                      <th scope="col" className="px-2 py-1.5 font-medium">C</th>
                      {disponibles.map((k) => (
                        <th key={k} scope="col" className="px-2 py-1.5 font-medium">
                          Q {etiquetas[k].replace(" años", "")} (m³/s)
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["proyecto", "previa", "amortiguada", "sinAmortiguar"] as const).map((e) => {
                      const s = coef[e];
                      return (
                        <tr key={e} className="border-t border-border/40">
                          <td className="px-2 py-1 text-left font-sans">{NOMBRE_ESC[e]}</td>
                          <td className="px-2 py-1">{fmt(s.areaM2, 0)}</td>
                          <td className="px-2 py-1">{fmt(s.c, 4)}</td>
                          {disponibles.map((k) => (
                            <td key={k} className={`px-2 py-1 ${k === kDis ? "font-semibold" : ""}`}>
                              {q3(r.picos[e][k].q)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {tormentas[kDis] && (
                <BarrasHietograma
                  lluviasMm={tormentas[kDis]!.map((i) => (i * dMin) / 60)}
                  etiquetas={tormentas[kDis]!.map((_, j) => horaSwmm(j * dMin))}
                  intervaloMin={dMin}
                  ventana={null}
                />
              )}

              <GraficoLineas
                titulo={`Hidrogramas · ${etiquetas[kDis]}`}
                series={series}
                referenciasY={[{ y: picoPrev.q, etiqueta: `pico previo ${q3(picoPrev.q)}` }]}
                formatoX={(x) => fmt(x, 1)}
                formatoY={(y) => fmt(y, 2)}
                formatoXTooltip={(x) => `${horaSwmm(x * 60)} h`}
                formatoValor={(y) => `${q3(y)} m³/s`}
                ejeX="Tiempo (h)"
                ejeY="Caudal (m³/s)"
                desdeCero
                alto={260}
              />

              <div className="space-y-2 rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium">Para cargar en SWMM</p>
                <p className="text-xs text-muted-foreground">
                  Series de tiempo de {etiquetas[kDis]} en formato de archivo externo de SWMM (hora H:MM y valor), para un Inflow del nodo
                  amortiguador o un pluviómetro.
                </p>
                <div className="flex flex-wrap gap-1.5 print:hidden">
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() =>
                      descargarTexto(
                        serieSwmm(`Hidrograma al amortiguador ${etiquetas[kDis]} (m3/s)`, r.q.amortiguada[kDis], 1),
                        `hidrograma-amortiguador-${etiquetas[kDis].replace(/\s+/g, "")}.dat`
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Hidrograma al MCE (.dat)
                  </button>
                  <button
                    type="button"
                    className={botonArchivo}
                    onClick={() =>
                      descargarTexto(
                        serieSwmm(`Hidrograma proyecto ${etiquetas[kDis]} (m3/s)`, r.q.proyecto[kDis], 1),
                        `hidrograma-proyecto-${etiquetas[kDis].replace(/\s+/g, "")}.dat`
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Hidrograma proyecto (.dat)
                  </button>
                  {tormentas[kDis] && (
                    <button
                      type="button"
                      className={botonArchivo}
                      onClick={() =>
                        descargarTexto(
                          serieSwmm(`Lluvia ${etiquetas[kDis]} (mm/h)`, tormentas[kDis]!, dMin, 3),
                          `lluvia-${etiquetas[kDis].replace(/\s+/g, "")}.dat`
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Lluvia (.dat)
                    </button>
                  )}
                  <button type="button" className={botonArchivo} onClick={() => descargarXlsx([tablaHidrogramas(), tablaTormentas()], "mce-hidrogramas.xlsx")}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Todo (.xlsx)
                  </button>
                  <button type="button" className={botonArchivo} onClick={() => descargarCsv(tablaHidrogramas(), "mce-hidrogramas.csv")}>
                    <Download className="h-3.5 w-3.5" />
                    Hidrogramas (.csv)
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-3">
            <p className="spec-label">Después de SWMM: salida del amortiguador</p>
            <textarea
              id="swmm"
              value={swmmTxt}
              onChange={(e) => setSwmm(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={"Pegá la tabla de SWMM (tiempo y caudal), por ejemplo:\nElapsed  Elapsed  Total Inflow\n00:00:00  00:01:00  0.0001\n00:00:00  00:02:00  0.0003"}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5 print:hidden">
              <input
                ref={archivoSwmm}
                type="file"
                accept=".txt,.csv,.rpt,.dat,.tsv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void leerArchivo(f);
                  e.target.value = "";
                }}
              />
              <button type="button" className={botonArchivo} onClick={() => archivoSwmm.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                Abrir .txt / .csv / .rpt
              </button>
              {swmmTxt && (
                <button type="button" className={botonArchivo} onClick={() => setSwmm("")}>
                  Borrar
                </button>
              )}
              {swmm && swmm.errores.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {swmm.tH.length} puntos, de {horaSwmm(swmm.tH[0] * 60)} a {horaSwmm(swmm.tH[swmm.tH.length - 1] * 60)} h
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              En SWMM: tabla por objeto del nodo de salida del amortiguador (Total Inflow o el caudal del orificio), copiar y pegar acá. Se toma la
              última hora de cada línea y el último número como caudal (m³/s); se suma el hidrograma del área sin amortiguar de la misma
              tormenta.
            </p>
            {swmm && <ListaErrores titulo="No se pudo leer la salida de SWMM" errores={swmm.errores} />}
            {post && picoPrev && picoProy && (
              <>
                <PanelMetricas
                  horizontal
                  metricas={[
                    { etiqueta: "Pico salida amortiguador", valor: q3(post.picoSalida.q), nota: `m³/s a las ${horaSwmm(post.picoSalida.tH * 60)} h` },
                    {
                      etiqueta: "Pico con MCE (+ sin amortiguar)",
                      valor: q3(post.picoTotal.q),
                      nota: `m³/s · ${cumple ? "≤" : ">"} previa ${q3(picoPrev.q)}`,
                      destacada: true,
                    },
                    {
                      etiqueta: "Frente a la situación previa",
                      valor: cumple ? "Cumple" : "No cumple",
                      nota: `${fmt((post.picoTotal.q / picoPrev.q) * 100, 1)} % del pico previo`,
                    },
                    { etiqueta: "Almacenamiento implícito", valor: fmt(post.almacen, 0), nota: "m³ = máx ∫(entrada − salida) dt" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Reducción del pico de proyecto: {fmt((1 - post.picoTotal.q / picoProy.q) * 100, 1)} %. Volumen que sale del amortiguador:{" "}
                  {fmt(volumen(post.salida), 0)} m³ frente a {fmt(volumen(r!.q.amortiguada[kDis]), 0)} m³ que entran.
                </p>
              </>
            )}
          </div>

          {r && coef && tcs && picoProy && picoPrev && (
            <PanelFormulas
              titulo="Ver cálculo"
              filas={[
                {
                  etiqueta: "% impermeable proyecto",
                  formula: "A_imp / A_libre · 100",
                  sustitucion: `${fmt(aImp, 0)} / ${fmt(aLibre, 0)} · 100`,
                  valor: `${fmt(coef.porcImpProyecto, 2)} %`,
                },
                {
                  etiqueta: "% impermeable previa",
                  formula: "mín(% máx, A_imp,previa / A_libre · 100)",
                  sustitucion: `mín(${fmt(porcMax, 0)}, ${fmt(aImpPrev, 0)} / ${fmt(aLibre, 0)} · 100)`,
                  valor: `${fmt(coef.porcImpPrevia, 2)} %`,
                },
                {
                  etiqueta: "C proyecto",
                  formula: "(C_imp·A_imp + C_perm·(A_EIT − A_imp)) / A_EIT",
                  sustitucion: `(${fmt(cImp, 2)}·${fmt(aImp, 0)} + ${fmt(cPerm, 2)}·${fmt(aEit - aImp, 0)}) / ${fmt(aEit, 0)}`,
                  valor: fmt(coef.proyecto.c, 5),
                },
                {
                  etiqueta: "C previa",
                  formula: "(C_imp·A_imp,prev + C_perm·(A_libre − A_imp,prev)) / A_libre",
                  sustitucion: `(${fmt(cImp, 2)}·${fmt(coef.areaImpPreviaM2, 0)} + ${fmt(cPerm, 2)}·${fmt(aLibre - coef.areaImpPreviaM2, 0)}) / ${fmt(aLibre, 0)}`,
                  valor: fmt(coef.previa.c, 5),
                },
                {
                  etiqueta: "Kirpich",
                  formula: "Tc = 0,066·L(km)^0,77 / S^0,385",
                  sustitucion: `0,066·${fmt(lM / 1000, 3)}^0,77 / ${fmt(sMm, 5)}^0,385`,
                  valor: `${fmt(tcs.kirpich, 2)} min`,
                },
                {
                  etiqueta: "Desbordes (proyecto)",
                  formula: "Tc = 6,625·A(ha)^0,3·S(%)^−0,38·C^−0,45",
                  sustitucion: `6,625·${fmt(aEit / 1e4, 4)}^0,3·${fmt(sMm * 100, 3)}^−0,38·${fmt(coef.proyecto.c, 4)}^−0,45`,
                  valor: `${fmt(tcs.desbordesProy, 2)} min`,
                },
                {
                  etiqueta: "Desbordes (previa, C permeable)",
                  formula: "Tc = 6,625·A(ha)^0,3·S(%)^−0,38·C^−0,45",
                  sustitucion: `6,625·${fmt(aLibre / 1e4, 4)}^0,3·${fmt(sMm * 100, 3)}^−0,38·${fmt(cPerm, 2)}^−0,45`,
                  valor: `${fmt(tcs.desbordesPrev, 2)} min`,
                },
                {
                  etiqueta: "FAA (proyecto)",
                  formula: "Tc = 0,054·(1,1 − C)·L(m)^0,5 / S(%)^0,333",
                  sustitucion: `0,054·(1,1 − ${fmt(coef.proyecto.c, 4)})·${fmt(lM, 0)}^0,5 / ${fmt(sMm * 100, 3)}^0,333`,
                  valor: `${fmt(tcs.faaProy, 2)} min`,
                },
                {
                  etiqueta: "Tp (proyecto)",
                  formula: "D/2 + k·Tc",
                  sustitucion: `${fmt(dMin / 60, 4)}/2 + ${fmt(kTp, 2)}·${fmt(tcProyMin / 60, 4)}`,
                  valor: `${fmt(r.hu.proyecto.tpH, 4)} h`,
                },
                { etiqueta: "Tb", formula: "k·Tp", sustitucion: `${fmt(kTb, 2)}·${fmt(r.hu.proyecto.tpH, 4)}`, valor: `${fmt(r.hu.proyecto.tbH, 4)} h` },
                {
                  etiqueta: "Qp por mm (proyecto)",
                  formula: "2·A(ha)·10 / (3600·Tb)",
                  sustitucion: `2·${fmt(coef.proyecto.areaM2 / 1e4, 4)}·10 / (3600·${fmt(r.hu.proyecto.tbH, 4)})`,
                  valor: `${fmt(r.hu.proyecto.qpPorMm, 6)} m³/s/mm`,
                },
                {
                  etiqueta: "Hidrograma",
                  formula: "Q(t) = Σ_k triángulo(Qp·D·C·i_k, inicio k·D, Tp, Tb), paso 1 min",
                  sustitucion: `${tormentas[kDis]?.length ?? 0} pulsos de ${fmt(dMin, 0)} min`,
                  valor: `pico ${q3(picoProy.q)} m³/s`,
                },
                {
                  etiqueta: "Racional (referencia)",
                  formula: "Q = a·Tc^−b · A(ha) · C · 10/60",
                  sustitucion: `${fmt(montA, 2)}·${fmt(tcProyMin, 1)}^−${fmt(montB, 2)} · ${fmt(aEit / 1e4, 4)} · ${fmt(coef.proyecto.c, 4)} · 10/60`,
                  valor: `${q3(qRacionalMontana(montA, montB, tcProyMin, aEit / 1e4, coef.proyecto.c))} m³/s`,
                },
                {
                  etiqueta: "Volumen sobre el pico previo",
                  formula: "Σ máx(0, Q_proy − Q_previa,máx)·Δt",
                  sustitucion: `Δt = 60 s`,
                  valor: `${fmt(volumenSobre(r.q.proyecto[kDis], picoPrev.q), 2)} m³`,
                },
              ]}
            />
          )}
        </div>
      </div>
    </main>
  );
}
