"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaDaf } from "@/components/calculadoras/croquis/DiagramasProcesos";
import { calcularDaf } from "@/lib/calc/potabilizacion/daf";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("daf");

export default function DafPage() {
  const [qTexto, setQ] = useCampo("q", "1000");
  const [sTexto, setS] = useCampo("s", "400");
  const [tTexto, setT] = useCampo("t", "20");
  const [pTexto, setP] = useCampo("p", "400");
  const [fTexto, setF] = useCampo("f", "0,5");
  const [asTexto, setAs] = useCampo("as", "0,03");
  const [hlrTexto, setHlr] = useCampo("hlr", "5");
  const [slrTexto, setSlr] = useCampo("slr", "10");
  const [lbTexto, setLb] = useCampo("lb", "3");

  const errores: string[] = [];
  const num = (t: string, nombre: string) => {
    const x = aNumero(t);
    if (!Number.isFinite(x) || x <= 0) errores.push(`${nombre} tiene que ser un número mayor que cero.`);
    return x;
  };
  const d = {
    caudalM3d: num(qTexto, "El caudal"),
    solidosMgL: num(sTexto, "Los sólidos"),
    temperaturaC: aNumero(tTexto),
    presionKPa: num(pTexto, "La presión"),
    saturacion: num(fTexto, "La saturación"),
    relacionAS: num(asTexto, "A/S"),
    cargaHidraulicaMh: num(hlrTexto, "La carga hidráulica"),
    cargaSolidosMaxKgM2h: slrTexto.trim() === "" ? null : num(slrTexto, "La carga de sólidos"),
    relacionLB: num(lbTexto, "L/B"),
  };
  if (errores.length === 0 && d.saturacion * ((d.presionKPa + 101.35) / 101.35) <= 1) errores.push("Con esa presión y saturación no se libera aire (f·P ≤ 1).");
  const r = errores.length === 0 ? calcularDaf(d) : null;
  const avisos: string[] = [];
  if (r) {
    if (r.porcentajeRecirculacion > 50) avisos.push(`Recirculación del ${fmt(r.porcentajeRecirculacion, 0)} %: alta; subí la presión o bajá A/S.`);
    if (r.cumpleSolidos === false) avisos.push(`Carga de sólidos ${fmt(r.cargaSolidos, 1)} kg/m²·h mayor que la admitida: agrandá el área.`);
  }

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
              <CampoNumerico id="q" etiqueta="Caudal" sufijo="m³/d" valor={qTexto} onChange={setQ} />
              <CampoNumerico id="s" etiqueta="Sólidos (SST, aceites)" sufijo="mg/L" valor={sTexto} onChange={setS} />
              <CampoNumerico id="t" etiqueta="Temperatura" sufijo="°C" valor={tTexto} onChange={setT} />
            </div>
          </div>
          <div className="space-y-4">
            <p className="spec-label">Presurización y diseño</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="p" etiqueta="Presión manométrica" sufijo="kPa" valor={pTexto} onChange={setP} advertencia="Habitual 275–480 kPa." />
              <CampoNumerico id="f" etiqueta="Fracción de saturación f" valor={fTexto} onChange={setF} advertencia="0,5 sin relleno; 0,8 con relleno." />
              <CampoNumerico id="as" etiqueta="Relación A/S" sufijo="mL/mg" valor={asTexto} onChange={setAs} advertencia="Habitual 0,005–0,06; idealmente de ensayo." />
              <CampoNumerico id="hlr" etiqueta="Carga hidráulica" sufijo="m/h" valor={hlrTexto} onChange={setHlr} advertencia="Sobre (Q + R)." />
              <CampoNumerico id="slr" etiqueta="Carga de sólidos máx." sufijo="kg/m²·h" valor={slrTexto} onChange={setSlr} />
              <CampoNumerico id="lb" etiqueta="L/B" valor={lbTexto} onChange={setLb} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Valores de diseño de partida de bibliografía (Metcalf & Eddy): ajustalos con ensayos de flotación.</p>
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {r && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Recirculación", valor: `${fmt(r.recirculacion, 0)} m³/d`, nota: `${fmt(r.porcentajeRecirculacion, 1)} % de Q`, destacada: true },
                  { etiqueta: "Área", valor: `${fmt(r.area, 2)} m²`, nota: `${fmt(r.largo, 2)} × ${fmt(r.ancho, 2)} m` },
                  { etiqueta: "Carga de sólidos", valor: `${fmt(r.cargaSolidos, 2)} kg/m²·h` },
                  { etiqueta: "Aire", valor: `${fmt(r.aireKgH, 3)} kg/h`, nota: `${fmt(r.aireLh, 0)} L/h` },
                ]}
              />
              <DiagramaDaf largoM={r.largo} anchoM={r.ancho} recirculacionM3d={r.recirculacion} porcentaje={r.porcentajeRecirculacion} presionKPa={d.presionKPa} caudalM3d={d.caudalM3d} />
              <ListaAvisos avisos={avisos} />
              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  { etiqueta: "sa", formula: "solubilidad del aire a T", sustitucion: `${fmt(d.temperaturaC, 1)} °C`, valor: `${fmt(r.sa, 2)} mL/L` },
                  { etiqueta: "P", formula: "(p + 101,35) / 101,35", sustitucion: `(${fmt(d.presionKPa, 0)} + 101,35)/101,35`, valor: `${fmt(r.P, 3)} atm` },
                  { etiqueta: "R", formula: "(A/S)·Sa·Q / (1,3·sa·(f·P − 1))", sustitucion: `${fmt(d.relacionAS, 3)}·${fmt(d.solidosMgL, 0)}·${fmt(d.caudalM3d, 0)}/(1,3·${fmt(r.sa, 2)}·(${fmt(d.saturacion, 2)}·${fmt(r.P, 3)} − 1))`, valor: `${fmt(r.recirculacion, 1)} m³/d` },
                  { etiqueta: "A", formula: "(Q + R) / carga hidráulica", sustitucion: `${fmt(r.qTotalM3h, 2)} m³/h / ${fmt(d.cargaHidraulicaMh, 1)}`, valor: `${fmt(r.area, 2)} m²` },
                  { etiqueta: "Carga de sólidos", formula: "Sa·Q / A", sustitucion: `${fmt(r.solidosKgH, 2)} kg/h / ${fmt(r.area, 2)}`, valor: `${fmt(r.cargaSolidos, 2)} kg/m²·h` },
                ]}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
