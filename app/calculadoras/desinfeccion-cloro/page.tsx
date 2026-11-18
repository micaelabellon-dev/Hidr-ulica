"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaCloro } from "@/components/calculadoras/croquis/DiagramasTratamiento";
import { fmtParametro } from "@/components/calculadoras/tratamiento/Calidad";
import { calcularCloracion } from "@/lib/calc/tratamiento/cloracion";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("desinfeccion-cloro");

export default function DesinfeccionCloroPage() {
  const [caudalTexto, setCaudal] = useCampo("caudal", "138,67");
  const [cfInicialTexto, setCfInicial] = useCampo("cfInicial", "6152");
  const [cfFinalTexto, setCfFinal] = useCampo("cfFinal", "0,5");
  const [tiempoTexto, setTiempo] = useCampo("tiempo", "30");
  const [tTexto, setT] = useCampo("temperatura", "12");
  const [lambdaTexto, setLambda] = useCampo("lambda", "2");
  const [q10Texto, setQ10] = useCampo("q10", "2,5");
  const [nTexto, setN] = useCampo("n", "1");
  const [residualTexto, setResidual] = useCampo("residual", "1");
  const [demandaTexto, setDemanda] = useCampo("demanda", "5");
  const [consumoTexto, setConsumo] = useCampo("consumo", "1,5");
  const [redondear, setRedondear] = useCampo("redondear", "Sí");
  const [fraccionTexto, setFraccion] = useCampo("fraccion", "10");
  const [densidadTexto, setDensidad] = useCampo("densidad", "1,2");
  const [horasTexto, setHoras] = useCampo("horas", "24");
  const [largoTexto, setLargo] = useCampo("largo", "2");
  const [anchoTexto, setAncho] = useCampo("ancho", "2");
  const [dTuboTexto, setDTubo] = useCampo("dTubo", "181,2");

  const errores: string[] = [];
  const num = (t: string, nombre: string, positivo = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (positivo ? v <= 0 : v < 0)) errores.push(`${nombre} tiene que ser un número ${positivo ? "mayor que cero" : "≥ 0"}.`);
    return v;
  };
  const datos = {
    caudalM3d: num(caudalTexto, "El caudal"),
    cfInicial: num(cfInicialTexto, "Los coliformes de entrada"),
    cfFinal: num(cfFinalTexto, "Los coliformes objetivo"),
    tiempoMin: num(tiempoTexto, "El tiempo de contacto"),
    lambda20: num(lambdaTexto, "λ"),
    q10: num(q10Texto, "Q10"),
    temperaturaC: aNumero(tTexto),
    n: num(nTexto, "n"),
    residualMgL: num(residualTexto, "El residual", false),
    demandaInmediataMgL: num(demandaTexto, "La demanda inmediata", false),
    consumoPrevioMgL: num(consumoTexto, "El consumo previo", false),
    redondearDosis: redondear === "Sí",
    fraccionActiva: num(fraccionTexto, "La concentración del producto") / 100,
    densidadGmL: num(densidadTexto, "La densidad"),
    horasDosificacion: num(horasTexto, "Las horas de dosificación"),
    camara: { largoM: num(largoTexto, "El largo de la cámara"), anchoM: num(anchoTexto, "El ancho de la cámara") },
    tuberiaDiametroM: num(dTuboTexto, "El diámetro de la tubería") / 1000,
  };
  if (!Number.isFinite(datos.temperaturaC)) errores.push("La temperatura no es un número.");
  if (errores.length === 0 && datos.cfFinal >= datos.cfInicial) errores.push("Los coliformes objetivo tienen que ser menores que los de entrada.");
  const r = errores.length === 0 ? calcularCloracion(datos) : null;

  const avisos: string[] = [];
  if (r) {
    if (datos.tiempoMin < 30) avisos.push("Tiempo de contacto menor a 30 min con el caudal medio: lo habitual es 30 min con el caudal máximo.");
    if (r.dosisTotalMgL > 15) avisos.push("Dosis alta: revisá la demanda de cloro del efluente; puede convenir decloración antes del vertido.");
  }

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
            <p className="spec-label">Efluente y objetivo</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="caudal" etiqueta="Caudal" sufijo="m³/d" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico id="temperatura" etiqueta="Temperatura" sufijo="°C" valor={tTexto} onChange={setT} />
              <CampoNumerico id="cfInicial" etiqueta="CF de entrada" sufijo="UFC/100 mL" valor={cfInicialTexto} onChange={setCfInicial} />
              <CampoNumerico id="cfFinal" etiqueta="CF objetivo" sufijo="UFC/100 mL" valor={cfFinalTexto} onChange={setCfFinal} />
              <CampoNumerico id="tiempo" etiqueta="Tiempo de contacto" sufijo="min" valor={tiempoTexto} onChange={setTiempo} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Cinética (Chick-Watson)</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="lambda" etiqueta="λ a 20 °C" sufijo="L/mg·min" valor={lambdaTexto} onChange={setLambda} />
              <CampoNumerico id="q10" etiqueta="Q10" valor={q10Texto} onChange={setQ10} />
              <CampoNumerico id="n" etiqueta="n" valor={nTexto} onChange={setN} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Dosis</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="residual" etiqueta="Residual" sufijo="mg/L" valor={residualTexto} onChange={setResidual} />
              <CampoNumerico id="demanda" etiqueta="Demanda inmediata" sufijo="mg/L" valor={demandaTexto} onChange={setDemanda} />
              <CampoNumerico id="consumo" etiqueta="Consumo previo" sufijo="mg/L" valor={consumoTexto} onChange={setConsumo} />
            </div>
            <div className="w-56">
              <CampoSeleccion id="redondear" etiqueta="Redondear la dosis al mg/L" valor={redondear === "No" ? "No" : "Sí"} opciones={["Sí", "No"]} onChange={setRedondear} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Hipoclorito y contacto</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="fraccion" etiqueta="Cloro activo" sufijo="%" valor={fraccionTexto} onChange={setFraccion} />
              <CampoNumerico id="densidad" etiqueta="Densidad" sufijo="g/mL" valor={densidadTexto} onChange={setDensidad} />
              <CampoNumerico id="horas" etiqueta="Dosificación" sufijo="h/d" valor={horasTexto} onChange={setHoras} />
              <CampoNumerico id="largo" etiqueta="Cámara: largo" sufijo="m" valor={largoTexto} onChange={setLargo} />
              <CampoNumerico id="ancho" etiqueta="Cámara: ancho" sufijo="m" valor={anchoTexto} onChange={setAncho} />
              <CampoNumerico id="dTubo" etiqueta="O tubería: D int." sufijo="mm" valor={dTuboTexto} onChange={setDTubo} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Hipoclorito de sodio comercial: 10 % de cloro activo y 1,2 g/mL es habitual.</p>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Cloro para inactivar", valor: `${fmt(r.concentracionMgL, 3)} mg/L`, nota: `CT = ${fmt(r.ctMgMinL, 2)} mg·min/L` },
                  { etiqueta: "Dosis total", valor: `${fmt(r.dosisTotalMgL, r.dosisTotalMgL % 1 ? 2 : 0)} mg/L`, nota: `${fmt(r.masaCloroGd, 0)} g Cl₂/d`, destacada: true },
                  { etiqueta: "Hipoclorito", valor: `${fmt(r.volumenProductoLd, 2)} L/d`, nota: `${fmt(r.caudalDosificadoraLh, 3)} L/h de dosificadora` },
                  { etiqueta: "Volumen de contacto", valor: `${fmt(r.volumenContactoM3, 2)} m³`, nota: `cámara H = ${fmt(r.alturaCamaraM, 2)} m · tubería L = ${fmt(r.largoTuberiaM, 0)} m` },
                ]}
              />
              <DiagramaCloro
                largoM={datos.camara.largoM}
                anchoM={datos.camara.anchoM}
                alturaM={r.alturaCamaraM}
                dosisMgL={r.dosisTotalMgL}
                litrosDia={r.volumenProductoLd}
                tiempoMin={datos.tiempoMin}
              />
              <ListaAvisos avisos={avisos} />
              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  {
                    etiqueta: "λ_T",
                    formula: "λ_20 · Q10^((T − 20)/10)",
                    sustitucion: `${fmt(datos.lambda20, 3)} · ${fmt(datos.q10, 2)}^((${fmt(datos.temperaturaC, 1)} − 20)/10)`,
                    valor: `${fmt(r.lambdaT, 4)} L/mg·min`,
                  },
                  {
                    etiqueta: "log remoción",
                    formula: "log10(N0/N)",
                    sustitucion: `log10(${fmtParametro("cf", datos.cfInicial)} / ${fmt(datos.cfFinal, 2)})`,
                    valor: `${fmt(r.logRemocion, 3)} log (${fmt(r.remocionPct, 4)} %)`,
                  },
                  {
                    etiqueta: "C",
                    formula: "[log10(N0/N) / (λ_T·t)]^(1/n)",
                    sustitucion: `[${fmt(r.logRemocion, 3)} / (${fmt(r.lambdaT, 4)}·${fmt(datos.tiempoMin, 0)})]^(1/${fmt(datos.n, 2)})`,
                    valor: `${fmt(r.concentracionMgL, 4)} mg/L`,
                  },
                  {
                    etiqueta: "Dosis",
                    formula: `C + residual + demanda + consumo${datos.redondearDosis ? " (redondeada)" : ""}`,
                    sustitucion: `${fmt(r.concentracionMgL, 3)} + ${fmt(datos.residualMgL, 2)} + ${fmt(datos.demandaInmediataMgL, 2)} + ${fmt(datos.consumoPrevioMgL, 2)}`,
                    valor: `${fmt(r.dosisTotalMgL, 2)} mg/L`,
                  },
                  { etiqueta: "Masa de cloro", formula: "dosis · Q", sustitucion: `${fmt(r.dosisTotalMgL, 2)} · ${fmt(datos.caudalM3d, 2)}`, valor: `${fmt(r.masaCloroGd, 1)} g/d` },
                  { etiqueta: "Producto", formula: "masa / fracción activa", sustitucion: `${fmt(r.masaCloroGd, 1)} / ${fmt(datos.fraccionActiva, 3)}`, valor: `${fmt(r.masaProductoGd, 0)} g/d` },
                  { etiqueta: "Volumen", formula: "producto / densidad", sustitucion: `${fmt(r.masaProductoGd, 0)} / ${fmt(datos.densidadGmL, 2)} / 1000`, valor: `${fmt(r.volumenProductoLd, 3)} L/d → ${fmt(r.caudalDosificadoraLh, 3)} L/h` },
                  { etiqueta: "V contacto", formula: "Q · t", sustitucion: `${fmt(datos.caudalM3d, 2)} · ${fmt(datos.tiempoMin, 0)} / 1440`, valor: `${fmt(r.volumenContactoM3, 3)} m³` },
                  { etiqueta: "H cámara", formula: "V / (L·B)", sustitucion: `${fmt(r.volumenContactoM3, 3)} / (${fmt(datos.camara.largoM, 2)}·${fmt(datos.camara.anchoM, 2)})`, valor: `${fmt(r.alturaCamaraM, 3)} m` },
                  { etiqueta: "L tubería", formula: "4V / (π·D²)", sustitucion: `4·${fmt(r.volumenContactoM3, 3)} / (π·${fmt(datos.tuberiaDiametroM, 4)}²)`, valor: `${fmt(r.largoTuberiaM, 1)} m` },
                ]}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
