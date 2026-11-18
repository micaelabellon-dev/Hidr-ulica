"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { escribirCampos, useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaLaguna } from "@/components/calculadoras/croquis/DiagramasTratamiento";
import { calidadANumeros, calidadATexto, CamposCalidad, fmtParametro, leerCalidad, TablaCalidad, type CalidadTexto } from "@/components/calculadoras/tratamiento/Calidad";
import { calcularLaguna, cargaSuperficialAdmisible } from "@/lib/calc/tratamiento/laguna-facultativa";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("laguna-facultativa");
const metaHumedal = buscarCalculadora("humedal-vertical");

/** Efluente de una fosa séptica (planilla de ejemplo, 748 habitantes). */
const AFLUENTE_DEFECTO: CalidadTexto = { dbo: "175,3", sst: "88", cf: "5168774", nt: "40,5", nh4: "35", pt: "8,5", ph: "7" };

export default function LagunaFacultativaPage() {
  const [caudalTexto, setCaudal] = useCampo("caudal", "138,67");
  const [habTexto, setHab] = useCampo("habitantes", "748");
  const [tTexto, setT] = useCampo("temperatura", "12");
  const [afluenteJson, setAfluenteJson] = useCampo("afluente", JSON.stringify(AFLUENTE_DEFECTO));
  const [lbTexto, setLb] = useCampo("lb", "2");
  const [hTexto, setH] = useCampo("profundidad", "1,5");
  const [lodoTexto, setLodo] = useCampo("lodo", "0,2");
  const [taludTexto, setTalud] = useCampo("talud", "2");
  const [coefDTexto, setCoefD] = useCampo("coefD", "1,1014");
  const [remSsTexto, setRemSs] = useCampo("remSs", "50");
  const [dboSsTexto, setDboSs] = useCampo("dboSs", "0,3");
  const [thetaDboTexto, setThetaDbo] = useCampo("thetaDbo", "1,035");
  const [thetaCfTexto, setThetaCf] = useCampo("thetaCf", "1,07");
  const [remPTexto, setRemP] = useCampo("remP", "10");
  const [tasaLodoTexto, setTasaLodo] = useCampo("tasaLodo", "0,04");

  const afluenteTexto = leerCalidad(afluenteJson, AFLUENTE_DEFECTO);
  const errores: string[] = [];
  const num = (t: string, nombre: string, positivo = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (positivo ? v <= 0 : v < 0)) errores.push(`${nombre} tiene que ser un número ${positivo ? "mayor que cero" : "≥ 0"}.`);
    return v;
  };
  const datos = {
    caudalM3d: num(caudalTexto, "El caudal"),
    afluente: calidadANumeros(afluenteTexto, errores),
    temperaturaC: num(tTexto, "La temperatura", false),
    habitantes: num(habTexto, "Los habitantes"),
    relacionLB: num(lbTexto, "La relación L/B"),
    profundidadM: num(hTexto, "La profundidad"),
    alturaLodoM: num(lodoTexto, "La altura de lodo", false),
    taludZ: num(taludTexto, "El talud", false),
    coefDispersion: num(coefDTexto, "El coeficiente de d"),
    remocionSsPct: num(remSsTexto, "La remoción de SS", false),
    dboPorSs: num(dboSsTexto, "La relación DBO/SS", false),
    thetaDbo: num(thetaDboTexto, "θ de DBO"),
    thetaCf: num(thetaCfTexto, "θ de CF"),
    remocionPPct: num(remPTexto, "La remoción de P", false),
    tasaLodoM3HabAnio: num(tasaLodoTexto, "La tasa de lodo"),
  };
  if (errores.length === 0 && datos.alturaLodoM >= datos.profundidadM) errores.push("El lodo no puede ocupar toda la profundidad.");
  const r = errores.length === 0 ? calcularLaguna(datos) : null;

  const avisos: string[] = [];
  if (r) {
    if (r.limpia.largoFondoM <= 0 || r.limpia.anchoFondoM <= 0) avisos.push("El fondo queda con largo o ancho negativo: bajá la profundidad o el talud.");
    if (r.limpia.tiempoRetencionD < 15) avisos.push(`Tiempo de retención de ${fmt(r.limpia.tiempoRetencionD, 1)} días: para una facultativa se recomiendan 15 a 45 días.`);
    if (datos.profundidadM < 1.5 || datos.profundidadM > 2)
      avisos.push("Profundidad fuera del rango habitual de 1,5 a 2,0 m para lagunas facultativas.");
    if (r.lodo.aniosEntreLimpiezas < 5) avisos.push("Menos de 5 años entre limpiezas de lodo.");
  }

  const pasarAlHumedal = () => {
    if (!r) return;
    escribirCampos(metaHumedal.ruta, { caudal: caudalTexto, afluente: calidadATexto(r.limpia.efluente) });
  };

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
            <p className="spec-label">Afluente</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="caudal" etiqueta="Caudal medio" sufijo="m³/d" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico id="habitantes" etiqueta="Habitantes" valor={habTexto} onChange={setHab} />
              <CampoNumerico id="temperatura" etiqueta="T mes más frío" sufijo="°C" valor={tTexto} onChange={setT} />
            </div>
            <CamposCalidad id="afluente" valor={afluenteTexto} onChange={(v) => setAfluenteJson(JSON.stringify(v))} />
          </div>

          <div className="space-y-4">
            <p className="spec-label">Geometría</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="lb" etiqueta="Relación L/B" valor={lbTexto} onChange={setLb} />
              <CampoNumerico id="profundidad" etiqueta="Profundidad útil H" sufijo="m" valor={hTexto} onChange={setH} />
              <CampoNumerico id="lodo" etiqueta="Altura de lodo" sufijo="m" valor={lodoTexto} onChange={setLodo} />
              <CampoNumerico id="talud" etiqueta="Talud interno (H:V)" valor={taludTexto} onChange={setTalud} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Parámetros de remoción</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <CampoNumerico id="coefD" etiqueta="Coef. c en d" valor={coefDTexto} onChange={setCoefD} />
              <CampoNumerico id="remSs" etiqueta="Remoción SS" sufijo="%" valor={remSsTexto} onChange={setRemSs} />
              <CampoNumerico id="dboSs" etiqueta="DBO / SS de salida" valor={dboSsTexto} onChange={setDboSs} />
              <CampoNumerico id="thetaDbo" etiqueta="θ DBO" valor={thetaDboTexto} onChange={setThetaDbo} />
              <CampoNumerico id="thetaCf" etiqueta="θ coliformes" valor={thetaCfTexto} onChange={setThetaCf} />
              <CampoNumerico id="remP" etiqueta="Remoción P" sufijo="%" valor={remPTexto} onChange={setRemP} />
              <CampoNumerico id="tasaLodo" etiqueta="Lodo" sufijo="m³/hab·año" valor={tasaLodoTexto} onChange={setTasaLodo} />
            </div>
            <p className="text-xs text-muted-foreground">
              d = (L/B)/(−0,261 + 0,254·(L/B) + c·(L/B)²). La planilla usa c = 1,1014; en von Sperling (2007) la fórmula figura con
              1,014: revisá cuál corresponde (con L/B = 2, d pasa de 0,430 a 0,465).
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Área del espejo", valor: `${fmt(r.areaM2, 1)} m²`, nota: `${fmt(r.largoM, 1)} × ${fmt(r.anchoM, 1)} m` },
                  { etiqueta: "Tiempo de retención", valor: `${fmt(r.limpia.tiempoRetencionD, 1)} d`, nota: `con lodo ${fmt(r.sucia.tiempoRetencionD, 1)} d` },
                  { etiqueta: "DBO de salida", valor: `${fmt(r.limpia.efluente.dbo, 1)} mg/L`, nota: `con lodo ${fmt(r.sucia.efluente.dbo, 1)}`, destacada: true },
                  { etiqueta: "Coliformes de salida", valor: fmtParametro("cf", r.limpia.efluente.cf), nota: "UFC/100 mL" },
                ]}
              />
              <DiagramaLaguna
                largoM={r.largoM}
                anchoM={r.anchoM}
                largoFondoM={r.limpia.largoFondoM}
                anchoFondoM={r.limpia.anchoFondoM}
                profundidadM={datos.profundidadM}
                alturaLodoM={datos.alturaLodoM}
                taludZ={datos.taludZ}
              />
              <ListaAvisos avisos={avisos} />

              <TablaCalidad
                afluente={datos.afluente}
                salidas={[
                  { titulo: "Laguna limpia", calidad: r.limpia.efluente },
                  { titulo: `Con ${fmt(datos.alturaLodoM * 100, 0)} cm de lodo`, calidad: r.sucia.efluente },
                ]}
              />

              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left text-xs font-medium">Dimensiones y lodo</caption>
                  <thead className="text-[11px] text-muted-foreground">
                    <tr>
                      <th scope="col" />
                      <th scope="col" className="px-2.5 py-1 text-right font-medium">Limpia</th>
                      <th scope="col" className="px-2.5 py-1 text-right font-medium">Con lodo</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] tabular-nums">
                    {(
                      [
                        ["Profundidad útil", (e) => `${fmt(e.profundidadM, 2)} m`],
                        ["Fondo (largo × ancho)", (e) => `${fmt(e.largoFondoM, 1)} × ${fmt(e.anchoFondoM, 1)} m`],
                        ["Volumen útil", (e) => `${fmt(e.volumenM3, 1)} m³`],
                        ["Tiempo de retención", (e) => `${fmt(e.tiempoRetencionD, 2)} d`],
                      ] as [string, (e: NonNullable<typeof r>["limpia"]) => string][]
                    ).map(([etq, f]) => (
                      <tr key={etq} className="border-t border-border/40">
                        <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                          {etq}
                        </th>
                        <td className="px-2.5 py-1 text-right">{f(r.limpia)}</td>
                        <td className="px-2.5 py-1 text-right">{f(r.sucia)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border/40">
                      <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                        Lodo: volumen / acumulación / años entre limpiezas
                      </th>
                      <td colSpan={2} className="px-2.5 py-1 text-right">
                        {fmt(r.lodo.volumenM3, 1)} m³ / {fmt(r.lodo.acumulacionM3Anio, 1)} m³/año / {fmt(r.lodo.aniosEntreLimpiezas, 1)} años
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end print:hidden">
                <Link href={metaHumedal.ruta} onClick={pasarAlHumedal} className={botonArchivo} title="Pasa caudal y efluente (laguna limpia) al humedal">
                  Seguir con el humedal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <PanelFormulas
                titulo="Ver cálculo · laguna limpia"
                filas={[
                  {
                    etiqueta: "Ls",
                    formula: "350·(1,107 − 0,002·T)^(T − 25)",
                    sustitucion: `350·(1,107 − 0,002·${fmt(datos.temperaturaC, 1)})^(${fmt(datos.temperaturaC, 1)} − 25) = ${fmt(cargaSuperficialAdmisible(datos.temperaturaC), 2)} → ↑ entero`,
                    valor: `${fmt(r.cargaSuperficialKgHaD, 0)} kg DBO/ha·d`,
                  },
                  { etiqueta: "L", formula: "Q · DBO / 1000", sustitucion: `${fmt(datos.caudalM3d, 1)} · ${fmt(datos.afluente.dbo, 2)} / 1000 → ↑ 0,1`, valor: `${fmt(r.cargaKgD, 1)} kg DBO/d` },
                  { etiqueta: "A", formula: "L / Ls", sustitucion: `${fmt(r.cargaKgD, 1)} / ${fmt(r.cargaSuperficialKgHaD, 0)} · 10 000`, valor: `${fmt(r.areaNecesariaM2, 1)} m²` },
                  {
                    etiqueta: "B, L",
                    formula: "B = √(A/(L/B)) ↑ 0,1;  L = (L/B)·B",
                    sustitucion: `√(${fmt(r.areaNecesariaM2, 1)}/${fmt(datos.relacionLB, 2)})`,
                    valor: `${fmt(r.anchoM, 1)} m × ${fmt(r.largoM, 1)} m = ${fmt(r.areaM2, 1)} m²`,
                  },
                  {
                    etiqueta: "V",
                    formula: "H/3·(A_sup + A_fondo + √(A_sup·A_fondo))",
                    sustitucion: `${fmt(datos.profundidadM, 2)}/3·(${fmt(r.areaM2, 1)} + ${fmt(r.limpia.areaFondoM2, 1)} + √(…))`,
                    valor: `${fmt(r.limpia.volumenM3, 1)} m³`,
                  },
                  { etiqueta: "t", formula: "V / Q", sustitucion: `${fmt(r.limpia.volumenM3, 1)} / ${fmt(datos.caudalM3d, 2)}`, valor: `${fmt(r.limpia.tiempoRetencionD, 2)} d` },
                  {
                    etiqueta: "d",
                    formula: "(L/B) / (−0,261 + 0,254·(L/B) + c·(L/B)²)",
                    sustitucion: `${fmt(r.largoM / r.anchoM, 2)} / (−0,261 + 0,254·${fmt(r.largoM / r.anchoM, 2)} + ${fmt(datos.coefDispersion, 4)}·${fmt(r.largoM / r.anchoM, 2)}²)`,
                    valor: fmt(r.numeroDispersion, 4),
                  },
                  {
                    etiqueta: "K_DBO",
                    formula: "(0,132·log Ls − 0,146)·θ^(T−20)",
                    sustitucion: `${fmt(r.k20Dbo, 4)} · ${fmt(datos.thetaDbo, 3)}^(${fmt(datos.temperaturaC, 1)} − 20)`,
                    valor: `${fmt(r.limpia.kDbo, 4)} d⁻¹`,
                  },
                  {
                    etiqueta: "DBO soluble",
                    formula: "S0·4a·e^(1/2d) / [(1+a)²·e^(a/2d) − (1−a)²·e^(−a/2d)], a = √(1 + 4Ktd)",
                    sustitucion: `a = ${fmt(r.limpia.aDbo, 4)}`,
                    valor: `${fmt(r.limpia.dboSolubleMgL, 2)} mg/L`,
                  },
                  {
                    etiqueta: "DBO particulada",
                    formula: "(DBO/SS) · SS·(1 − rem.)",
                    sustitucion: `${fmt(datos.dboPorSs, 2)} · ${fmt(r.limpia.efluente.sst, 1)}`,
                    valor: `${fmt(r.limpia.dboParticuladaMgL, 2)} mg/L → total ${fmt(r.limpia.efluente.dbo, 2)} mg/L`,
                  },
                  {
                    etiqueta: "Kb (coliformes)",
                    formula: "0,542·H^−1,259 · θ^(T−20)",
                    sustitucion: `0,542·${fmt(datos.profundidadM, 2)}^−1,259 · ${fmt(datos.thetaCf, 3)}^(${fmt(datos.temperaturaC, 1)} − 20)`,
                    valor: `${fmt(r.limpia.kbCf, 4)} d⁻¹ → a = ${fmt(r.limpia.aCf, 4)}`,
                  },
                  { etiqueta: "CF salida", formula: "N0 · (Wehner-Wilhelm)", valor: `${fmtParametro("cf", r.limpia.efluente.cf)} UFC/100 mL` },
                  {
                    etiqueta: "N total",
                    formula: "N0 / [1 + t·(0,000576·T − 0,00028)·e^((1,08 − 0,042·T)(pH − 6,6))]",
                    valor: `${fmt(r.limpia.efluente.nt, 2)} mg/L`,
                  },
                  {
                    etiqueta: "N amoniacal",
                    formula: "N0 / [1 + (A/Q)·(0,0038 + 0,000134·T)·e^(1,54·(pH − 6,6))]",
                    sustitucion: `A/Q = ${fmt(r.areaM2 / datos.caudalM3d, 2)} d/m`,
                    valor: `${fmt(r.limpia.efluente.nh4, 2)} mg/L`,
                  },
                  {
                    etiqueta: "Años entre limpiezas",
                    formula: "(V_limpia − V_con lodo) / (tasa · hab)",
                    sustitucion: `${fmt(r.lodo.volumenM3, 1)} / (${fmt(datos.tasaLodoM3HabAnio, 3)} · ${fmt(datos.habitantes, 0)})`,
                    valor: `${fmt(r.lodo.aniosEntreLimpiezas, 2)} años`,
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
