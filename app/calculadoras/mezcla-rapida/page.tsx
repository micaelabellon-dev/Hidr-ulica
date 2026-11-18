"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { parshall, PARSHALL, placaOrificio } from "@/lib/calc/potabilizacion/mezcla-rapida";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("mezcla-rapida");

export default function MezclaRapidaPage() {
  const [metodo, setMetodo] = useCampo("metodo", "Placa orificio");
  const [qTexto, setQ] = useCampo("q", "28");
  // orificio
  const [vTexto, setV] = useCampo("v", "1");
  const [dAdopTexto, setDAdop] = useCampo("dAdop", "209,2");
  const [betaTexto, setBeta] = useCampo("beta", "1,4");
  const [cdTexto, setCd] = useCampo("cd", "0,61");
  const [pctTexto, setPct] = useCampo("pct", "49");
  const [largoTexto, setLargo] = useCampo("largo", "5");
  // parshall
  const [medida, setMedida] = useCampo("medida", "1'");
  const [gTexto, setG] = useCampo("g", "9,8");
  const [nuTexto, setNu] = useCampo("nu", "0,000001");

  const errores: string[] = [];
  const num = (t: string, nombre: string) => {
    const x = aNumero(t);
    if (!Number.isFinite(x) || x <= 0) errores.push(`${nombre} tiene que ser un número mayor que cero.`);
    return x;
  };
  const Q = num(qTexto, "El caudal") / 1000;
  const g = num(gTexto, "g");
  const nu = num(nuTexto, "ν");
  const esParshall = metodo === "Canaleta Parshall";
  const avisos: string[] = [];

  let contenido: React.ReactNode = null;
  if (!esParshall) {
    const datos = {
      caudalM3s: Q,
      velocidadMs: num(vTexto, "La velocidad"),
      diametroAdoptadoM: dAdopTexto.trim() === "" ? null : num(dAdopTexto, "El diámetro adoptado") / 1000,
      beta: num(betaTexto, "D/d"),
      cd: num(cdTexto, "Cd"),
      perdidaPermanente: num(pctTexto, "La pérdida permanente") / 100,
      largoMezclaDiametros: num(largoTexto, "El largo de mezcla"),
      nu,
      g,
    };
    if (datos.beta <= 1) errores.push("D/d tiene que ser mayor que 1.");
    const r = errores.length === 0 ? placaOrificio(datos) : null;
    if (r) {
      if (r.G < 700 || r.G > 2000) avisos.push("G fuera de 700–2000 s⁻¹, rango habitual de mezcla rápida.");
      if (r.tiempo > 10) avisos.push("Tiempo de mezcla mayor a 10 s.");
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Gradiente G", valor: `${fmt(r.G, 0)} s⁻¹`, destacada: true },
              { etiqueta: "Orificio d", valor: `${fmt(r.dOrificio * 1000, 1)} mm`, nota: `tubería D = ${fmt(r.D * 1000, 1)} mm` },
              { etiqueta: "Pérdida permanente", valor: `${fmt(r.hf, 3)} m`, nota: `h = ${fmt(r.h, 3)} m` },
              { etiqueta: "Tiempo de mezcla", valor: `${fmt(r.tiempo, 2)} s`, nota: `en ${fmt(r.largo, 2)} m` },
            ]}
          />
          <ListaAvisos avisos={avisos} />
          <PanelFormulas
            titulo="Ver cálculo"
            filas={[
              { etiqueta: "D teórico", formula: "√(4·Q/(π·v))", sustitucion: `√(4·${fmt(Q, 4)}/(π·${fmt(datos.velocidadMs, 2)}))`, valor: `${fmt(r.diametroTeorico * 1000, 1)} mm → adoptado ${fmt(r.D * 1000, 1)} mm` },
              { etiqueta: "d", formula: "D / β", sustitucion: `${fmt(r.D, 4)} / ${fmt(datos.beta, 2)}`, valor: `${fmt(r.dOrificio * 1000, 1)} mm` },
              { etiqueta: "h", formula: "Q²·(β⁴ − 1) / (3,48²·Cd²·D⁴)", sustitucion: `${fmt(Q, 4)}²·(${fmt(datos.beta, 2)}⁴ − 1)/(3,48²·${fmt(datos.cd, 2)}²·${fmt(r.D, 4)}⁴)`, valor: `${fmt(r.h, 4)} m` },
              { etiqueta: "hf", formula: "% · h", sustitucion: `${fmt(datos.perdidaPermanente, 2)} · ${fmt(r.h, 4)}`, valor: `${fmt(r.hf, 4)} m` },
              { etiqueta: "V mezcla", formula: "π·D²/4 · (k·D)", sustitucion: `π·${fmt(r.D, 4)}²/4 · ${fmt(r.largo, 3)}`, valor: `${fmt(r.volumen, 4)} m³` },
              { etiqueta: "G", formula: "√(g·Q·hf / (ν·V))", sustitucion: `√(${fmt(g, 2)}·${fmt(Q, 4)}·${fmt(r.hf, 4)}/(${fmt(nu * 1e6, 2)}×10⁻⁶·${fmt(r.volumen, 4)}))`, valor: `${fmt(r.G, 1)} s⁻¹` },
            ]}
          />
        </>
      );
    }
  } else {
    const m = PARSHALL.find((p) => p.nombre === medida) ?? PARSHALL[2];
    const r = errores.length === 0 ? parshall(m, Q, g, nu) : null;
    const todas = errores.length === 0 ? PARSHALL.map((p) => ({ p, r: parshall(p, Q, g, nu) })) : [];
    if (r) {
      if (!((r.Fr1 >= 2 && r.Fr1 <= 3) || (r.Fr1 >= 4.5 && r.Fr1 <= 9))) avisos.push("Fr1 fuera de 2–3 y 4,5–9: el resalto puede ser oscilante o débil.");
      if (r.G < 700 || r.G > 2000) avisos.push("G fuera de 700–2000 s⁻¹.");
      if (r.T > 1) avisos.push("Tiempo de mezcla mayor a 1 s.");
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Gradiente G", valor: `${fmt(r.G, 0)} s⁻¹`, destacada: true },
              { etiqueta: "Froude Fr1", valor: fmt(r.Fr1, 2), nota: `h1 = ${fmt(r.h1 * 100, 1)} cm · h2 = ${fmt(r.h2 * 100, 1)} cm` },
              { etiqueta: "Tiempo de mezcla", valor: `${fmt(r.T, 2)} s` },
              { etiqueta: "Pérdida en el resalto", valor: `${fmt(r.hp, 3)} m`, nota: `Ha = ${fmt(r.Ha, 3)} m` },
            ]}
          />
          <ListaAvisos avisos={avisos} />
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
              <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left font-sans text-xs font-medium">Comparación de medidas para Q = {fmt(Q * 1000, 1)} L/s</caption>
              <thead className="font-sans text-[11px] text-muted-foreground">
                <tr>{["W", "Ha (m)", "Fr1", "T (s)", "G (s⁻¹)"].map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {todas.map(({ p, r: x }) => (
                  <tr key={p.nombre} className={`border-t border-border/40 ${p.nombre === m.nombre ? "bg-accent/60 font-semibold" : ""}`}>
                    <td className="px-2 py-1">{p.nombre}</td>
                    <td className="px-2 py-1">{fmt(x.Ha, 3)}</td>
                    <td className="px-2 py-1">{Number.isFinite(x.Fr1) ? fmt(x.Fr1, 2) : "—"}</td>
                    <td className="px-2 py-1">{Number.isFinite(x.T) ? fmt(x.T, 2) : "—"}</td>
                    <td className="px-2 py-1">{Number.isFinite(x.G) ? fmt(x.G, 0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelFormulas
            titulo="Ver cálculo"
            filas={[
              { etiqueta: "Ha", formula: "k·Q^n", sustitucion: `${fmt(m.k, 3)}·${fmt(Q, 4)}^${fmt(m.n, 3)}`, valor: `${fmt(r.Ha, 4)} m` },
              { etiqueta: "D'", formula: "(2/3)(D − W) + W", valor: `${fmt(r.Dp, 4)} m` },
              { etiqueta: "Va", formula: "Q/(D'·Ha)", valor: `${fmt(r.Va, 4)} m/s` },
              { etiqueta: "E0", formula: "Va²/2g + Ha + N", sustitucion: `${fmt(r.Va, 4)}²/(2·${fmt(g, 2)}) + ${fmt(r.Ha, 4)} + ${fmt(m.N, 3)}`, valor: `${fmt(r.E0, 4)} m` },
              { etiqueta: "cos θ", formula: "−q·g / ((2/3)·g·E0)^1,5", sustitucion: `q = Q/W = ${fmt(r.q, 4)} m²/s`, valor: `${fmt(r.cosTheta, 4)} → θ = ${fmt(r.theta, 4)} rad` },
              { etiqueta: "V1", formula: "2·√((2/3)·g·E0)·cos(θ/3)", valor: `${fmt(r.V1, 4)} m/s` },
              { etiqueta: "h1, Fr1", formula: "q/V1 ; V1/√(g·h1)", valor: `${fmt(r.h1, 4)} m ; ${fmt(r.Fr1, 3)}` },
              { etiqueta: "h2", formula: "(h1/2)(√(1 + 8·Fr1²) − 1)", valor: `${fmt(r.h2, 4)} m` },
              { etiqueta: "h3", formula: "h2 − (N − K)", valor: `${fmt(r.h3, 4)} m` },
              { etiqueta: "hp", formula: "Ha + K − h3", valor: `${fmt(r.hp, 4)} m` },
              { etiqueta: "T", formula: "2·G'/(V2 + V3)", sustitucion: `2·${fmt(m.G, 3)}/(${fmt(r.V2, 4)} + ${fmt(r.V3, 4)})`, valor: `${fmt(r.T, 4)} s` },
              { etiqueta: "G", formula: "√(g·hp/(ν·T))", valor: `${fmt(r.G, 1)} s⁻¹` },
            ]}
          />
        </>
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-4xl font-medium">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={esParshall ? "Canaleta Parshall" : "Placa orificio"} onMetodoChange={setMetodo} />
      </div>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Caudal</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="q" etiqueta="Caudal" sufijo="L/s" valor={qTexto} onChange={setQ} />
              <CampoNumerico id="g" etiqueta="g" sufijo="m/s²" valor={gTexto} onChange={setG} />
              <CampoNumerico id="nu" etiqueta="ν" sufijo="m²/s" valor={nuTexto} onChange={setNu} />
            </div>
          </div>
          {!esParshall ? (
            <div className="space-y-4">
              <p className="spec-label">Placa orificio</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="v" etiqueta="Velocidad en la tubería" sufijo="m/s" valor={vTexto} onChange={setV} />
                <CampoNumerico id="dAdop" etiqueta="D interior adoptado" sufijo="mm" valor={dAdopTexto} onChange={setDAdop} advertencia="Vacío para usar el teórico." />
                <CampoNumerico id="beta" etiqueta="β = D/d" valor={betaTexto} onChange={setBeta} />
                <CampoNumerico id="cd" etiqueta="Cd" valor={cdTexto} onChange={setCd} />
                <CampoNumerico id="pct" etiqueta="Pérdida permanente" sufijo="% de h" valor={pctTexto} onChange={setPct} />
                <CampoNumerico id="largo" etiqueta="Largo de mezcla" sufijo="× D" valor={largoTexto} onChange={setLargo} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="spec-label">Canaleta Parshall</p>
              <CampoSeleccion id="medida" etiqueta="Ancho de garganta W" valor={medida} opciones={PARSHALL.map((p) => p.nombre)} onChange={setMedida} />
              <p className="text-xs text-muted-foreground">Medidas normalizadas (D, N, C, G′, K) y coeficientes k, n de Ha = k·Q^n con Q en m³/s.</p>
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {contenido}
        </div>
      </div>
    </main>
  );
}
