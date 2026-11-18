"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaSedimentadorCircular, DiagramaSedimentadorLaminar, DiagramaSedimentadorRectangular } from "@/components/calculadoras/croquis/DiagramasProcesos";
import { decantadorConvencional, decantadorLaminar, stokes } from "@/lib/calc/potabilizacion/sedimentacion";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("sedimentador");

export default function SedimentadorPage() {
  const [metodo, setMetodo] = useCampo("metodo", "Convencional");
  const [qTexto, setQ] = useCampo("q", "2419");
  const [csTexto, setCs] = useCampo("cs", "30");
  const [hTexto, setH] = useCampo("h", "3,5");
  const [forma, setForma] = useCampo("forma", "rectangular");
  const [lbTexto, setLb] = useCampo("lb", "4");
  const [unidadesTexto, setUnidades] = useCampo("unidades", "2");
  const [vertTexto, setVert] = useCampo("vert", "");
  const [vscTexto, setVsc] = useCampo("vsc", "20");
  const [eTexto, setE] = useCampo("e", "5");
  const [lTexto, setL] = useCampo("l", "1,2");
  const [angTexto, setAng] = useCampo("ang", "60");
  const [dpTexto, setDp] = useCampo("dp", "0,05");
  const [rhoTexto, setRho] = useCampo("rho", "1050");

  const errores: string[] = [];
  const num = (t: string, nombre: string) => {
    const x = aNumero(t);
    if (!Number.isFinite(x) || x <= 0) errores.push(`${nombre} tiene que ser un número mayor que cero.`);
    return x;
  };
  const Q = num(qTexto, "El caudal");
  const laminar = metodo === "Laminar (placas)";
  const avisos: string[] = [];
  let contenido: React.ReactNode = null;

  if (!laminar) {
    const d = {
      caudalM3d: Q,
      cargaSuperficialM3m2d: num(csTexto, "La carga superficial"),
      profundidadM: num(hTexto, "La profundidad"),
      forma: (forma === "circular" ? "circular" : "rectangular") as "circular" | "rectangular",
      relacionLB: num(lbTexto, "L/B"),
      unidades: Math.round(num(unidadesTexto, "Las unidades")),
      largoVertederoM: vertTexto.trim() === "" ? null : num(vertTexto, "El largo de vertedero"),
    };
    const r = errores.length === 0 ? decantadorConvencional(d) : null;
    if (r) {
      if (r.tiempoH < 1.5) avisos.push(`Tiempo de retención ${fmt(r.tiempoH, 2)} h, menor que 1,5 h.`);
      if (r.cargaVertedero > 250) avisos.push(`Carga sobre vertedero ${fmt(r.cargaVertedero, 0)} m³/m·d, mayor que 125–250: agregá canaletas.`);
      if (d.forma === "rectangular" && r.vh * 100 > 1.5) avisos.push("Velocidad horizontal mayor a 1,5 cm/s: riesgo de arrastre.");
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Área por unidad", valor: `${fmt(r.area, 1)} m²`, nota: d.forma === "rectangular" ? `${fmt(r.largo, 2)} × ${fmt(r.ancho, 2)} m` : `Ø ${fmt(r.diametro, 2)} m`, destacada: true },
              { etiqueta: "Retención", valor: `${fmt(r.tiempoH, 2)} h`, nota: `V = ${fmt(r.volumen, 0)} m³` },
              { etiqueta: "Carga sobre vertedero", valor: `${fmt(r.cargaVertedero, 0)} m³/m·d`, nota: `L = ${fmt(r.lVert, 1)} m` },
              { etiqueta: "Remoción primaria", valor: `DBO ${fmt(r.remDbo, 0)} % · SST ${fmt(r.remSst, 0)} %`, nota: "Metcalf & Eddy" },
            ]}
          />
          {d.forma === "rectangular" ? (
            <DiagramaSedimentadorRectangular largoM={r.largo} anchoM={r.ancho} profundidadM={d.profundidadM} unidades={d.unidades} tiempoH={r.tiempoH} />
          ) : (
            <DiagramaSedimentadorCircular diametroM={r.diametro} profundidadM={d.profundidadM} unidades={d.unidades} tiempoH={r.tiempoH} />
          )}
          <ListaAvisos avisos={avisos} />
          <PanelFormulas
            titulo="Ver cálculo"
            filas={[
              { etiqueta: "A", formula: "(Q/unidades) / CS", sustitucion: `${fmt(r.qUnidad, 1)} / ${fmt(d.cargaSuperficialM3m2d, 1)}`, valor: `${fmt(r.area, 2)} m²` },
              { etiqueta: "t", formula: "A·H / Q", sustitucion: `${fmt(r.area, 2)}·${fmt(d.profundidadM, 2)}/${fmt(r.qUnidad, 1)}·24`, valor: `${fmt(r.tiempoH, 3)} h` },
              ...(d.forma === "rectangular" ? [{ etiqueta: "vh", formula: "Q/(B·H)", valor: `${fmt(r.vh * 100, 3)} cm/s` }] : []),
              { etiqueta: "Remoción DBO", formula: "t/(0,018 + 0,020·t)", valor: `${fmt(r.remDbo, 1)} %` },
              { etiqueta: "Remoción SST", formula: "t/(0,0075 + 0,014·t)", valor: `${fmt(r.remSst, 1)} %` },
            ]}
          />
        </>
      );
    }
  } else {
    const d = { caudalM3d: Q, vscMd: num(vscTexto, "La vsc"), espaciamientoM: num(eTexto, "El espaciamiento") / 100, largoPlacaM: num(lTexto, "El largo de placa"), anguloGrados: num(angTexto, "El ángulo"), nu: 1e-6 };
    const r = errores.length === 0 ? decantadorLaminar(d) : null;
    if (r) {
      if (r.re > 500) avisos.push(`Re = ${fmt(r.re, 0)}: el flujo entre placas deja de ser laminar (< 500; mejor < 250).`);
      if (r.Lp <= 0) avisos.push("La longitud útil corregida es negativa: alargá las placas o bajá la velocidad.");
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Área en planta", valor: `${fmt(r.area, 1)} m²`, destacada: true },
              { etiqueta: "v0 entre placas", valor: `${fmt(r.v0 * 100, 3)} cm/s`, nota: `${fmt(r.v0Md, 0)} m/d` },
              { etiqueta: "Reynolds", valor: fmt(r.re, 0), nota: "< 500" },
              { etiqueta: "Carga aparente", valor: `${fmt(r.cargaAparente, 0)} m³/m²·d` },
            ]}
          />
          <DiagramaSedimentadorLaminar anguloGrados={d.anguloGrados} espaciamientoM={d.espaciamientoM} largoPlacaM={d.largoPlacaM} v0Md={r.v0Md} areaM2={r.area} />
          <ListaAvisos avisos={avisos} />
          <PanelFormulas
            titulo="Ver cálculo"
            filas={[
              { etiqueta: "L", formula: "l / e", sustitucion: `${fmt(d.largoPlacaM, 2)} / ${fmt(d.espaciamientoM, 3)}`, valor: fmt(r.L, 2) },
              { etiqueta: "L' (corregida)", formula: "L − 0,058·v0·e/ν", valor: fmt(r.Lp, 2) },
              { etiqueta: "v0", formula: "vsc·(sen θ + L'·cos θ)", sustitucion: `${fmt(d.vscMd, 1)} m/d · (sen ${fmt(d.anguloGrados, 0)}° + ${fmt(r.Lp, 2)}·cos ${fmt(d.anguloGrados, 0)}°)`, valor: `${fmt(r.v0Md, 1)} m/d` },
              { etiqueta: "A", formula: "Q / (v0·sen θ)", valor: `${fmt(r.area, 2)} m²` },
              { etiqueta: "Re", formula: "v0·e/ν", valor: fmt(r.re, 1) },
            ]}
          />
        </>
      );
    }
  }
  const st = aNumero(dpTexto) > 0 && aNumero(rhoTexto) > 0 ? stokes(aNumero(dpTexto) / 1000, aNumero(rhoTexto)) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={laminar ? "Laminar (placas)" : "Convencional"} onMetodoChange={setMetodo} />
      </div>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Caudal</p>
            <CampoNumerico id="q" etiqueta="Caudal" sufijo="m³/d" valor={qTexto} onChange={setQ} />
          </div>
          {!laminar ? (
            <div className="space-y-4">
              <p className="spec-label">Decantador convencional</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="cs" etiqueta="Carga superficial" sufijo="m³/m²·d" valor={csTexto} onChange={setCs} advertencia="Primario 30–50; agua floculada 20–40." />
                <CampoNumerico id="h" etiqueta="Profundidad" sufijo="m" valor={hTexto} onChange={setH} />
                <CampoSeleccion id="forma" etiqueta="Forma" valor={forma === "circular" ? "circular" : "rectangular"} opciones={["rectangular", "circular"]} onChange={setForma} />
                {forma !== "circular" && <CampoNumerico id="lb" etiqueta="L/B" valor={lbTexto} onChange={setLb} />}
                <CampoNumerico id="unidades" etiqueta="Unidades" valor={unidadesTexto} onChange={setUnidades} />
                <CampoNumerico id="vert" etiqueta="Largo de vertedero" sufijo="m" valor={vertTexto} onChange={setVert} advertencia="Vacío: el ancho o el perímetro." />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="spec-label">Decantador de placas (Yao)</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="vsc" etiqueta="Velocidad crítica vsc" sufijo="m/d" valor={vscTexto} onChange={setVsc} advertencia="Agua floculada: 15–30 m/d." />
                <CampoNumerico id="e" etiqueta="Separación entre placas" sufijo="cm" valor={eTexto} onChange={setE} />
                <CampoNumerico id="l" etiqueta="Largo de placa" sufijo="m" valor={lTexto} onChange={setL} />
                <CampoNumerico id="ang" etiqueta="Inclinación θ" sufijo="°" valor={angTexto} onChange={setAng} />
              </div>
            </div>
          )}
          <div className="space-y-4">
            <p className="spec-label">Velocidad de Stokes de una partícula</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="dp" etiqueta="Diámetro" sufijo="mm" valor={dpTexto} onChange={setDp} />
              <CampoNumerico id="rho" etiqueta="Densidad" sufijo="kg/m³" valor={rhoTexto} onChange={setRho} />
            </div>
            {st && (
              <p className="text-xs text-muted-foreground">
                vs = g·(ρp − ρ)·d²/(18μ) = {fmt(st.vs * 1000, 4)} mm/s = {fmt(st.vs * 86400, 2)} m/d · Re = {fmt(st.re, 4)}
                {st.re > 1 ? " (Re > 1: Stokes deja de valer)" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {contenido}
        </div>
      </div>
    </main>
  );
}
