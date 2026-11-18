"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { escribirCampos, useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { calidadANumeros, CamposCalidad, fmtParametro, leerCalidad, TablaCalidad, type CalidadTexto } from "@/components/calculadoras/tratamiento/Calidad";
import { calcularHumedal, type CapaFiltrante } from "@/lib/calc/tratamiento/humedal";
import { NOMBRE_PARAMETRO } from "@/lib/calc/tratamiento/comun";
import { numeroDeCelda } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("humedal-vertical");
const metaCloro = buscarCalculadora("desinfeccion-cloro");

/** Efluente de una laguna facultativa (planilla de ejemplo). */
const AFLUENTE_DEFECTO: CalidadTexto = { dbo: "60,05", sst: "44", cf: "615249", nt: "35,14", nh4: "30,66", pt: "7,65", ph: "7" };
const CAPAS_DEFECTO: string[][] = [
  ["Arena gruesa (0,06–4 mm)", "0,5", "0,35"],
  ["Transición, grava (4–8 mm)", "0,1", "0,3"],
  ["Drenaje, grava gruesa", "0,2", "0,25"],
];
const REMOCIONES = ["dbo", "sst", "cf", "nh4", "nt", "pt"] as const;
const REM_DEFECTO: Record<(typeof REMOCIONES)[number], string> = { dbo: "90", sst: "90", cf: "99", nh4: "90", nt: "0", pt: "10" };
const PARAM_KADLEC = { "N amoniacal": "nh4", DBO: "dbo", "N total": "nt" } as const;

export default function HumedalVerticalPage() {
  const [caudalTexto, setCaudal] = useCampo("caudal", "87,5");
  const [afluenteJson, setAfluenteJson] = useCampo("afluente", JSON.stringify(AFLUENTE_DEFECTO));
  const [hlrTexto, setHlr] = useCampo("hlr", "0,12");
  const [trenesTexto, setTrenes] = useCampo("trenes", "2");
  const [lbTexto, setLb] = useCampo("lb", "1,5");
  const [taludTexto, setTalud] = useCampo("talud", "2");
  const [capas, setCapas] = useTabla("capas", CAPAS_DEFECTO);
  const [remJson, setRemJson] = useCampo("remociones", JSON.stringify(REM_DEFECTO));
  const [kadlecUsar, setKadlecUsar] = useCampo("kadlecUsar", "Sí");
  const [kadlecParam, setKadlecParam] = useCampo("kadlecParam", "N amoniacal");
  const [kadlecCeTexto, setKadlecCe] = useCampo("kadlecCe", "5");
  const [kadlecCfTexto, setKadlecCf] = useCampo("kadlecCfondo", "1,5");
  const [kadlecPTexto, setKadlecP] = useCampo("kadlecP", "3");
  const [kadlecKTexto, setKadlecK] = useCampo("kadlecK", "26,5");

  const afluenteTexto = leerCalidad(afluenteJson, AFLUENTE_DEFECTO);
  const remTexto = useMemo(() => {
    try {
      return { ...REM_DEFECTO, ...JSON.parse(remJson) } as typeof REM_DEFECTO;
    } catch {
      return REM_DEFECTO;
    }
  }, [remJson]);

  const errores: string[] = [];
  const num = (t: string, nombre: string, positivo = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (positivo ? v <= 0 : v < 0)) errores.push(`${nombre} tiene que ser un número ${positivo ? "mayor que cero" : "≥ 0"}.`);
    return v;
  };
  const capasNum: CapaFiltrante[] = [];
  const erroresCapas: string[] = [];
  capas.forEach((f, i) => {
    if (!f.some((c) => (c ?? "").trim() !== "")) return;
    const e = numeroDeCelda(f[1] ?? "");
    const n = numeroDeCelda(f[2] ?? "");
    if (e === null || Number.isNaN(e) || e <= 0) erroresCapas.push(`Fila ${i + 1}: el espesor tiene que ser mayor que cero.`);
    if (n === null || Number.isNaN(n) || n <= 0 || n >= 1) erroresCapas.push(`Fila ${i + 1}: la porosidad va entre 0 y 1.`);
    capasNum.push({ nombre: (f[0] ?? "").trim() || `Capa ${i + 1}`, espesorM: e ?? NaN, porosidad: n ?? NaN });
  });
  const remociones = Object.fromEntries(
    REMOCIONES.map((k) => {
      const v = aNumero(remTexto[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) errores.push(`La remoción de ${NOMBRE_PARAMETRO[k]} va entre 0 y 100 %.`);
      return [k, v];
    })
  ) as Record<(typeof REMOCIONES)[number], number>;
  const paramK = PARAM_KADLEC[kadlecParam as keyof typeof PARAM_KADLEC] ?? "nh4";
  const datos = {
    caudalM3d: num(caudalTexto, "El caudal"),
    afluente: calidadANumeros(afluenteTexto, errores),
    tasaCargaHidraulica: num(hlrTexto, "La tasa de carga hidráulica"),
    trenes: Math.round(num(trenesTexto, "Los trenes")),
    relacionLB: num(lbTexto, "La relación L/B"),
    capas: capasNum,
    remocionesPct: remociones,
    taludZ: num(taludTexto, "El talud", false),
    kadlec:
      kadlecUsar === "Sí"
        ? {
            parametro: paramK,
            cEfluente: num(kadlecCeTexto, "La concentración objetivo"),
            cFondo: num(kadlecCfTexto, "C*", false),
            p: num(kadlecPTexto, "P (tanques en serie)"),
            kMAnio: num(kadlecKTexto, "k"),
          }
        : null,
  };
  if (datos.kadlec && errores.length === 0 && !(datos.kadlec.cEfluente > datos.kadlec.cFondo)) {
    errores.push("La concentración objetivo tiene que ser mayor que C*.");
  }
  const r = errores.length === 0 && erroresCapas.length === 0 ? calcularHumedal(datos) : null;

  const avisos: string[] = [];
  if (r) {
    if (r.kadlec && !r.kadlec.cumpleConArea)
      avisos.push(
        `Con el modelo P-k-C* hacen falta ${fmt(r.kadlec.areaM2, 0)} m² para llevar ${NOMBRE_PARAMETRO[paramK]} a ${fmt(datos.kadlec!.cEfluente, 1)} mg/L, más que los ${fmt(r.areaTotalM2, 0)} m² adoptados: la remoción del ${fmt(remociones[paramK as "nh4"], 0)} % adoptada puede ser optimista.`
      );
    if (r.capas.some((c) => c.areaInferiorM2 <= 0)) avisos.push("Con ese talud alguna capa se cierra en el fondo: bajá el talud o los espesores.");
  }

  const pasarACloro = () => {
    if (!r) return;
    escribirCampos(metaCloro.ruta, { caudal: caudalTexto, cfInicial: String(Math.round(r.efluente.cf)) });
  };

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
            <p className="spec-label">Afluente</p>
            <div className="w-40">
              <CampoNumerico id="caudal" etiqueta="Caudal medio" sufijo="m³/d" valor={caudalTexto} onChange={setCaudal} />
            </div>
            <CamposCalidad id="afluente" valor={afluenteTexto} onChange={(v) => setAfluenteJson(JSON.stringify(v))} />
          </div>

          <div className="space-y-4">
            <p className="spec-label">Dimensionamiento</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="hlr" etiqueta="Tasa de carga hidráulica" sufijo="m³/m²·d" valor={hlrTexto} onChange={setHlr} />
              <CampoNumerico id="trenes" etiqueta="Trenes en paralelo" valor={trenesTexto} onChange={setTrenes} />
              <CampoNumerico id="lb" etiqueta="Relación L/B" valor={lbTexto} onChange={setLb} />
              <CampoNumerico id="talud" etiqueta="Talud de las capas (H:V)" valor={taludTexto} onChange={setTalud} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Capas filtrantes, de arriba hacia abajo</p>
            <TablaEditable
              id="tabla-capas"
              columnas={[{ titulo: "Capa", texto: true }, { titulo: "Espesor", sufijo: "m" }, { titulo: "Porosidad" }]}
              filas={capas}
              onChange={setCapas}
              filasConError={filasDeErrores(erroresCapas)}
              filaNueva={() => ["", "", ""]}
            />
            <ListaErrores titulo="Errores en las capas" errores={erroresCapas} />
          </div>

          <div className="space-y-4">
            <p className="spec-label">Remociones adoptadas</p>
            <div className="grid grid-cols-3 gap-3">
              {REMOCIONES.map((k) => (
                <CampoNumerico
                  key={k}
                  id={`rem-${k}`}
                  etiqueta={NOMBRE_PARAMETRO[k]}
                  sufijo="%"
                  valor={remTexto[k]}
                  onChange={(v) => setRemJson(JSON.stringify({ ...remTexto, [k]: v }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Verificación P-k-C* (Kadlec y Wallace)</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion id="kadlecUsar" etiqueta="Verificar" valor={kadlecUsar === "No" ? "No" : "Sí"} opciones={["Sí", "No"]} onChange={setKadlecUsar} />
              {kadlecUsar !== "No" && (
                <CampoSeleccion
                  id="kadlecParam"
                  etiqueta="Parámetro"
                  valor={kadlecParam in PARAM_KADLEC ? kadlecParam : "N amoniacal"}
                  opciones={Object.keys(PARAM_KADLEC)}
                  onChange={setKadlecParam}
                />
              )}
            </div>
            {kadlecUsar !== "No" && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <CampoNumerico id="kadlecCe" etiqueta="C objetivo" sufijo="mg/L" valor={kadlecCeTexto} onChange={setKadlecCe} />
                <CampoNumerico id="kadlecCfondo" etiqueta="C*" sufijo="mg/L" valor={kadlecCfTexto} onChange={setKadlecCf} />
                <CampoNumerico id="kadlecP" etiqueta="P" valor={kadlecPTexto} onChange={setKadlecP} />
                <CampoNumerico id="kadlecK" etiqueta="k" sufijo="m/año" valor={kadlecKTexto} onChange={setKadlecK} />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Área total", valor: `${fmt(r.areaTotalM2, 1)} m²`, nota: `${datos.trenes} × ${fmt(r.largoM, 1)} × ${fmt(r.anchoM, 1)} m`, destacada: true },
                  { etiqueta: "Carga hidráulica real", valor: `${fmt(r.tasaRealM3m2d, 3)} m/d` },
                  { etiqueta: "Carga orgánica", valor: `${fmt(r.cargaOrganicaGm2d, 1)} g DBO/m²·d` },
                  { etiqueta: "Retención en el medio", valor: `${fmt(r.tiempoRetencionD, 2)} d` },
                ]}
              />
              <ListaAvisos avisos={avisos} />
              <TablaCalidad afluente={datos.afluente} salidas={[{ titulo: "Efluente", calidad: r.efluente }]} />

              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                  <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left font-sans text-xs font-medium">Materiales por capa</caption>
                  <thead className="font-sans text-[11px] text-muted-foreground">
                    <tr>
                      {["Capa", "Espesor", "Área sup.", "Área inf.", "Vol. por tren", "Vol. total"].map((t) => (
                        <th key={t} scope="col" className="px-2 py-1 font-medium">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.capas.map((c) => (
                      <tr key={c.nombre} className="border-t border-border/40">
                        <td className="px-2 py-1 text-left font-sans">{c.nombre}</td>
                        <td className="px-2 py-1">{fmt(c.espesorM, 2)} m</td>
                        <td className="px-2 py-1">{fmt(c.areaSuperiorM2, 1)} m²</td>
                        <td className="px-2 py-1">{fmt(c.areaInferiorM2, 1)} m²</td>
                        <td className="px-2 py-1">{fmt(c.volumenPorTrenM3, 1)} m³</td>
                        <td className="px-2 py-1 font-semibold">{fmt(c.volumenTotalM3, 1)} m³</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end print:hidden">
                <Link href={metaCloro.ruta} onClick={pasarACloro} className={botonArchivo} title="Pasa caudal y coliformes del efluente a la desinfección">
                  Seguir con la desinfección
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  { etiqueta: "A", formula: "Q / HLR (↑ 0,1)", sustitucion: `${fmt(datos.caudalM3d, 2)} / ${fmt(datos.tasaCargaHidraulica, 3)}`, valor: `${fmt(r.areaNecesariaM2, 1)} m²` },
                  { etiqueta: "A por tren", formula: "A / trenes (↑ 0,1)", sustitucion: `${fmt(r.areaNecesariaM2, 1)} / ${datos.trenes}`, valor: `${fmt(r.areaPorTrenM2, 1)} m²` },
                  {
                    etiqueta: "B, L",
                    formula: "B = √(A_tren/(L/B)) ↑ 0,1;  L = (L/B)·B ↑ 0,1",
                    sustitucion: `√(${fmt(r.areaPorTrenM2, 1)}/${fmt(datos.relacionLB, 2)})`,
                    valor: `${fmt(r.anchoM, 1)} × ${fmt(r.largoM, 1)} m → total ${fmt(r.areaTotalM2, 1)} m²`,
                  },
                  {
                    etiqueta: "T retención",
                    formula: "Σ(n·h) / HLR",
                    sustitucion: datos.capas.map((c) => `${fmt(c.porosidad, 2)}·${fmt(c.espesorM, 2)}`).join(" + ") + ` / ${fmt(datos.tasaCargaHidraulica, 3)}`,
                    valor: `${fmt(r.tiempoRetencionD, 3)} d`,
                  },
                  ...REMOCIONES.map((k) => ({
                    etiqueta: `${NOMBRE_PARAMETRO[k]} salida`,
                    formula: "C_in · (1 − remoción)",
                    sustitucion: `${fmtParametro(k, datos.afluente[k])} · (1 − ${fmt(remociones[k] / 100, 2)})`,
                    valor: fmtParametro(k, r.efluente[k]),
                  })),
                  ...(r.kadlec && datos.kadlec
                    ? [
                        {
                          etiqueta: "A (P-k-C*)",
                          formula: "(P·Q·365/k)·[((C_in − C*)/(C_e − C*))^(1/P) − 1]",
                          sustitucion: `(${fmt(datos.kadlec.p, 1)}·${fmt(datos.caudalM3d, 2)}·365/${fmt(datos.kadlec.kMAnio, 1)})·[(${fmt(datos.afluente[paramK], 2)} − ${fmt(datos.kadlec.cFondo, 2)})/(${fmt(datos.kadlec.cEfluente, 2)} − ${fmt(datos.kadlec.cFondo, 2)}))^(1/${fmt(datos.kadlec.p, 1)}) − 1]`,
                          valor: `${fmt(r.kadlec.areaM2, 1)} m² ${r.kadlec.cumpleConArea ? "≤" : ">"} ${fmt(r.areaTotalM2, 1)} m² adoptados`,
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
