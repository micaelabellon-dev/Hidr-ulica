"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { escribirCampos, useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaPozoHumedo } from "@/components/calculadoras/croquis/DiagramaPozoHumedo";
import { calcularPozoHumedo, type FormaPozo } from "@/lib/calc/hidraulica/pozo-humedo";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("pozo-humedo");
const metaBombeo = buscarCalculadora("bombeo-pozo");

const texto = (n: number, d = 3) => String(+n.toFixed(d)).replace(".", ",");

export default function PozoHumedoPage() {
  const [caudalTexto, setCaudal] = useCampo("caudal", "12,5");
  const [caudalMinTexto, setCaudalMin] = useCampo("caudalMin", "5");
  const [arranquesTexto, setArranques] = useCampo("arranques", "6");
  const [formaNombre, setFormaNombre] = useCampo("forma", "Circular");
  const [diametroTexto, setDiametro] = useCampo("diametro", "1,5");
  const [largoTexto, setLargo] = useCampo("largo", "2");
  const [anchoTexto, setAncho] = useCampo("ancho", "1,5");
  const [areaTexto, setArea] = useCampo("area", "");
  const [alturaUtilTexto, setAlturaUtil] = useCampo("alturaUtil", "");
  const [cotaTapaTexto, setCotaTapa] = useCampo("cotaTapa", "4,5");
  const [zampeadosTexto, setZampeados] = useCampo("zampeados", "2,84; 2,58");
  const [revanchaTexto, setRevancha] = useCampo("revancha", "0,15");
  const [sumergenciaTexto, setSumergencia] = useCampo("sumergencia", "0,33");
  const [aroTexto, setAro] = useCampo("aro", "0,5");
  const [detencionTexto, setDetencion] = useCampo("detencionMax", "30");

  const forma: FormaPozo = formaNombre === "Rectangular" ? "rectangular" : "circular";
  const errores: string[] = [];
  const num = (t: string, nombre: string, positivo = false) => {
    const v = aNumero(t);
    if (!Number.isFinite(v)) errores.push(`${nombre} no es un número.`);
    else if (positivo && v <= 0) errores.push(`${nombre} tiene que ser mayor que cero.`);
    else if (v < 0) errores.push(`${nombre} no puede ser negativo.`);
    return v;
  };
  const opcional = (t: string, nombre: string) => (t.trim() === "" ? null : num(t, nombre, true));

  const zampeados = zampeadosTexto
    .split(/[;\s]+/)
    .filter(Boolean)
    .map((z) => aNumero(z));
  if (zampeados.length === 0 || zampeados.some((z) => !Number.isFinite(z))) {
    errores.push("Cargá las cotas de zampeado de las entradas, separadas por punto y coma.");
  }

  const datos = {
    caudalBombeoLs: num(caudalTexto, "El caudal de bombeo", true),
    caudalMinimoLs: num(caudalMinTexto, "El caudal mínimo de entrada", true),
    arranquesPorHora: num(arranquesTexto, "Los arranques por hora", true),
    forma,
    diametroM: forma === "circular" ? num(diametroTexto, "El diámetro", true) : 0,
    largoM: forma === "rectangular" ? num(largoTexto, "El largo", true) : 0,
    anchoM: forma === "rectangular" ? num(anchoTexto, "El ancho", true) : 0,
    areaAdoptadaM2: opcional(areaTexto, "El área adoptada"),
    alturaUtilAdoptadaM: opcional(alturaUtilTexto, "La altura útil adoptada"),
    cotaTapaM: aNumero(cotaTapaTexto),
    cotasZampeadoM: zampeados,
    revanchaM: num(revanchaTexto, "La revancha"),
    sumergenciaM: num(sumergenciaTexto, "La sumergencia"),
    alturaAroM: aroTexto.trim() === "" ? 0 : num(aroTexto, "La altura de aro"),
    tiempoDetencionMaxMin: num(detencionTexto, "El tiempo de detención máximo", true),
  };
  if (!Number.isFinite(datos.cotaTapaM)) errores.push("La cota de tapa no es un número.");

  const r = errores.length === 0 ? calcularPozoHumedo(datos) : null;

  const llevarABombeo = () => {
    if (!r) return;
    escribirCampos(metaBombeo.ruta, {
      cotaMin: texto(r.cotaNivelMinimoM),
      cotaMax: texto(r.cotaNivelMaximoM),
      cotaAdmision: texto(r.cotaFondoM),
      sumergencia: texto(datos.sumergenciaM),
      caudal: caudalTexto,
    });
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
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Caudales y arranques</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="caudal" etiqueta="Caudal de bombeo" sufijo="L/s" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico id="caudalMin" etiqueta="Caudal mínimo de entrada" sufijo="L/s" valor={caudalMinTexto} onChange={setCaudalMin} />
              <CampoNumerico id="arranques" etiqueta="Arranques por hora" sufijo="1/h" valor={arranquesTexto} onChange={setArranques} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Caudal de la bomba (o de las que arrancan juntas). Arranques por hora máximos según el fabricante del motor: 6 a 10
              es habitual en bombas sumergibles chicas.
            </p>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Planta del pozo</p>
            <CampoSeleccion id="forma" etiqueta="Forma" valor={forma === "rectangular" ? "Rectangular" : "Circular"} opciones={["Circular", "Rectangular"]} onChange={setFormaNombre} />
            {forma === "circular" ? (
              <CampoNumerico id="diametro" etiqueta="Diámetro interior" sufijo="m" valor={diametroTexto} onChange={setDiametro} />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="largo" etiqueta="Largo interior" sufijo="m" valor={largoTexto} onChange={setLargo} />
                <CampoNumerico id="ancho" etiqueta="Ancho interior" sufijo="m" valor={anchoTexto} onChange={setAncho} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="area"
                etiqueta="Área adoptada (opcional)"
                sufijo="m²"
                valor={areaTexto}
                onChange={setArea}
                advertencia={r ? `Calculada: ${fmt(r.areaCalculadaM2, 3)} m². Vacío para usarla.` : undefined}
              />
              <CampoNumerico
                id="alturaUtil"
                etiqueta="Altura útil adoptada (opcional)"
                sufijo="m"
                valor={alturaUtilTexto}
                onChange={setAlturaUtil}
                advertencia={r ? `Necesaria: ${fmt(r.alturaUtilNecesariaM, 3)} m. Vacío: se redondea hacia arriba a 5 cm.` : undefined}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Cotas y alturas</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="cotaTapa" etiqueta="Cota de tapa" sufijo="m" valor={cotaTapaTexto} onChange={setCotaTapa} />
              <CampoNumerico
                id="zampeados"
                etiqueta="Zampeado de las entradas"
                sufijo="m"
                valor={zampeadosTexto}
                onChange={setZampeados}
                advertencia="Una o más, separadas por «;». Manda la más baja."
              />
              <CampoNumerico id="revancha" etiqueta="Revancha bajo la entrada" sufijo="m" valor={revanchaTexto} onChange={setRevancha} />
              <CampoNumerico id="sumergencia" etiqueta="Sumergencia de las bombas" sufijo="m" valor={sumergenciaTexto} onChange={setSumergencia} />
              <CampoNumerico id="aro" etiqueta="Altura de cada aro" sufijo="m" valor={aroTexto} onChange={setAro} advertencia="Vacío si no es de aros." />
              <CampoNumerico id="detencionMax" etiqueta="Detención máxima" sufijo="min" valor={detencionTexto} onChange={setDetencion} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Revancha: entre el nivel máximo y el zampeado, para que el colector no remanse (mínimo 10 cm, mejor 15; 30 cm
              para caudales grandes). Sumergencia: la mínima del fabricante sobre la bomba.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {!r ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">Completá los datos para dimensionar el pozo.</div>
          ) : (
            <>
              <DiagramaPozoHumedo
                cotaTapaM={datos.cotaTapaM}
                cotaZampeadoM={r.cotaZampeadoM}
                cotaNivelMaximoM={r.cotaNivelMaximoM}
                cotaNivelMinimoM={r.cotaNivelMinimoM}
                cotaFondoM={r.cotaFondoM}
                cantidadAros={r.cantidadAros}
                alturaAroM={datos.alturaAroM}
              />
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Volumen útil", valor: `${fmt(r.volumenUtilM3, 2)} m³`, nota: `necesario ${fmt(r.volumenUtilNecesarioM3, 3)} m³` },
                  { etiqueta: "Altura útil", valor: `${fmt(r.alturaUtilM, 2)} m`, nota: `necesaria ${fmt(r.alturaUtilNecesariaM, 3)} m` },
                  {
                    etiqueta: "Profundidad total",
                    valor: `${fmt(r.profundidadTotalM, 2)} m`,
                    nota: r.cantidadAros !== null ? `${r.cantidadAros} aros de ${fmt(datos.alturaAroM, 2)} m` : undefined,
                    destacada: true,
                  },
                  {
                    etiqueta: "Detención con Q mín.",
                    valor: `${fmt(r.detencion.llenadoMin, 1)} min`,
                    nota: r.detencion.cumple ? `≤ ${fmt(datos.tiempoDetencionMaxMin, 0)} min, verifica` : `> ${fmt(datos.tiempoDetencionMaxMin, 0)} min, no verifica`,
                  },
                ]}
              />
              <ListaAvisos avisos={r.avisos} />

              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left text-xs font-medium">Cotas y tiempos</caption>
                  <tbody className="font-mono text-[13px] tabular-nums">
                    {[
                      ["Cota de tapa", `${fmt(datos.cotaTapaM, 2)} m`],
                      ["Zampeado de entrada (más bajo)", `${fmt(r.cotaZampeadoM, 2)} m`],
                      ["Nivel máximo (arranque)", `${fmt(r.cotaNivelMaximoM, 2)} m`],
                      ["Nivel mínimo (parada)", `${fmt(r.cotaNivelMinimoM, 2)} m`],
                      ["Fondo", `${fmt(r.cotaFondoM, 2)} m`],
                      ["Profundidad del zampeado", `${fmt(r.profundidadZampeadoM, 2)} m`],
                      ["Volumen total del pozo", `${fmt(r.volumenTotalM3, 2)} m³`],
                      ["Arranques por hora (peor caso)", fmt(r.arranquesRealesPorHora, 1)],
                      ["Llenado con Q mín.", `${fmt(r.detencion.llenadoMin, 1)} min`],
                      ["Vaciado con Q mín.", r.detencion.vaciadoMin !== null ? `${fmt(r.detencion.vaciadoMin, 1)} min` : "—"],
                      ["Ciclo con Q mín.", r.detencion.cicloMin !== null ? `${fmt(r.detencion.cicloMin, 1)} min` : "—"],
                    ].map(([e, v]) => (
                      <tr key={e} className="border-t border-border/40 first:border-0">
                        <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                          {e}
                        </th>
                        <td className="px-2.5 py-1 text-right">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end print:hidden">
                <Link href={metaBombeo.ruta} onClick={llevarABombeo} className={botonArchivo} title="Pasa caudal, niveles y sumergencia a la calculadora de bombeo">
                  Calcular la bomba con estos niveles
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  { etiqueta: "T_ciclo", formula: "60 / arranques por hora", sustitucion: `60 / ${fmt(datos.arranquesPorHora, 0)}`, valor: `${fmt(r.tiempoCicloMin, 2)} min` },
                  {
                    etiqueta: "V_útil necesario",
                    formula: "Q · T_ciclo / 4",
                    sustitucion: `${fmt(datos.caudalBombeoLs / 1000, 4)} m³/s · 60 · ${fmt(r.tiempoCicloMin, 2)} / 4`,
                    valor: `${fmt(r.volumenUtilNecesarioM3, 3)} m³`,
                  },
                  {
                    etiqueta: "A",
                    formula: forma === "circular" ? "π·D²/4" : "largo · ancho",
                    sustitucion:
                      datos.areaAdoptadaM2 !== null
                        ? `adoptada (calculada ${fmt(r.areaCalculadaM2, 3)})`
                        : forma === "circular"
                          ? `π·${fmt(datos.diametroM, 2)}²/4`
                          : `${fmt(datos.largoM, 2)} · ${fmt(datos.anchoM, 2)}`,
                    valor: `${fmt(r.areaM2, 3)} m²`,
                  },
                  { etiqueta: "h_útil necesaria", formula: "V / A", sustitucion: `${fmt(r.volumenUtilNecesarioM3, 3)} / ${fmt(r.areaM2, 3)}`, valor: `${fmt(r.alturaUtilNecesariaM, 3)} m → adoptada ${fmt(r.alturaUtilM, 2)} m` },
                  { etiqueta: "Nivel máx.", formula: "z_zampeado − revancha", sustitucion: `${fmt(r.cotaZampeadoM, 2)} − ${fmt(datos.revanchaM, 2)}`, valor: `${fmt(r.cotaNivelMaximoM, 2)} m` },
                  { etiqueta: "Nivel mín.", formula: "nivel máx. − h_útil", sustitucion: `${fmt(r.cotaNivelMaximoM, 2)} − ${fmt(r.alturaUtilM, 2)}`, valor: `${fmt(r.cotaNivelMinimoM, 2)} m` },
                  { etiqueta: "Fondo", formula: "nivel mín. − sumergencia", sustitucion: `${fmt(r.cotaNivelMinimoM, 2)} − ${fmt(datos.sumergenciaM, 2)}`, valor: `${fmt(r.cotaFondoM, 2)} m` },
                  {
                    etiqueta: "Profundidad",
                    formula: "z_tapa − z_fondo",
                    sustitucion: `${fmt(datos.cotaTapaM, 2)} − ${fmt(r.cotaFondoM, 2)}`,
                    valor: `${fmt(r.profundidadTotalM, 2)} m${r.cantidadAros !== null ? ` → ${r.cantidadAros} aros` : ""}`,
                  },
                  {
                    etiqueta: "Arranques reales",
                    formula: "60 / (4·V_útil / Q)",
                    sustitucion: `60 / (4 · ${fmt(r.volumenUtilM3, 3)} / (${fmt(datos.caudalBombeoLs / 1000, 4)} · 60))`,
                    valor: `${fmt(r.arranquesRealesPorHora, 2)} /h`,
                  },
                  {
                    etiqueta: "Detención",
                    formula: "V_útil / Q_mín",
                    sustitucion: `${fmt(r.volumenUtilM3, 3)} / (${fmt(datos.caudalMinimoLs / 1000, 4)} · 60)`,
                    valor: `${fmt(r.detencion.llenadoMin, 2)} min`,
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
