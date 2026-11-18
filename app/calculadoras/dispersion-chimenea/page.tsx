"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import {
  concentracion,
  DESCRIPCION_ESTABILIDAD,
  emisionPorFactor,
  ESTABILIDADES,
  EXPONENTE_VIENTO,
  LB_A_KG,
  perfilSuelo,
  pluma,
  sigmasBriggs,
  type Estabilidad,
} from "@/lib/calc/aire/dispersion";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("dispersion-chimenea");

function cientifica(v: number, d = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return fmt(v, Math.max(0, d - 1 - e));
  return `${fmt(v / 10 ** e, d - 1)}×10${String(e).replace(/-/g, "⁻").replace(/\d/g, (x) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+x])}`;
}

export default function DispersionChimeneaPage() {
  const [hTexto, setH] = useCampo("h", "20");
  const [dTexto, setD] = useCampo("d", "0,5");
  const [tsTexto, setTs] = useCampo("ts", "403");
  const [vsTexto, setVs] = useCampo("vs", "15");
  const [emisionModo, setEmisionModo] = useCampo("emisionModo", "Caudal másico");
  const [qTexto, setQ] = useCampo("q", "10000000000");
  const [consumoTexto, setConsumo] = useCampo("consumo", "2400");
  const [feTexto, setFe] = useCampo("fe", "34,6");
  const [feUnidad, setFeUnidad] = useCampo("feUnidad", "lb/t");
  const [taTexto, setTa] = useCampo("ta", "293");
  const [pTexto, setP] = useCampo("p", "1013");
  const [estabilidad, setEstabilidad] = useCampo("estabilidad", "A");
  const [superficie, setSuperficie] = useCampo("superficie", "urbana");
  const [nTexto, setN] = useCampo("n", "");
  const [h1Texto, setH1] = useCampo("h1", "10");
  const [u1Texto, setU1] = useCampo("u1", "10");
  const [xTexto, setX] = useCampo("x", "500");
  const [yTexto, setY] = useCampo("y", "0");
  const [zTexto, setZ] = useCampo("z", "0");
  const [sigmaModo, setSigmaModo] = useCampo("sigmaModo", "Briggs (fórmulas)");
  const [syTexto, setSy] = useCampo("sy", "114");
  const [szTexto, setSz] = useCampo("sz", "112,5");
  const [reflexion, setReflexion] = useCampo("reflexion", "Sí");
  const [hollandTexto, setHolland] = useCampo("holland", "0,00268");
  const [limiteTexto, setLimite] = useCampo("limite", "");

  const errores: string[] = [];
  const num = (t: string, nombre: string, min = 0, estricto = true) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || (estricto ? v <= min : v < min)) errores.push(`${nombre} tiene que ser un número ${estricto ? "mayor que" : "≥"} ${min}.`);
    return v;
  };
  const est = (ESTABILIDADES.includes(estabilidad as Estabilidad) ? estabilidad : "D") as Estabilidad;
  const sup = superficie === "rural" ? "rural" : "urbana";
  const porFactor = emisionModo === "Por factor de emisión";
  const feKgT = aNumero(feTexto) * (feUnidad === "lb/t" ? LB_A_KG : 1);
  const emision = porFactor ? emisionPorFactor(num(consumoTexto, "El consumo"), feKgT).ugS : num(qTexto, "La emisión");
  const manual = sigmaModo === "Cargados a mano";
  const datos = {
    alturaM: num(hTexto, "La altura de la chimenea"),
    diametroM: num(dTexto, "El diámetro"),
    tempGasK: num(tsTexto, "La temperatura del gas"),
    velocidadGasMs: num(vsTexto, "La velocidad del gas", 0, false),
    emisionUgS: emision,
    tempAireK: num(taTexto, "La temperatura del aire"),
    presionMb: num(pTexto, "La presión"),
    superficie: sup as "urbana" | "rural",
    estabilidad: est,
    exponente: nTexto.trim() === "" ? null : num(nTexto, "El exponente n"),
    alturaRefM: num(h1Texto, "La altura de referencia"),
    vientoRefMs: num(u1Texto, "El viento de referencia"),
    coefHolland: num(hollandTexto, "El coeficiente de Holland"),
    reflexion: reflexion === "Sí",
    sigmasManual: manual ? { sy: num(syTexto, "σy"), sz: num(szTexto, "σz") } : null,
  };
  const x = num(xTexto, "La distancia x");
  const y = aNumero(yTexto);
  const z = num(zTexto, "La altura z", 0, false);
  if (!Number.isFinite(y)) errores.push("La distancia y no es un número.");
  const limite = limiteTexto.trim() === "" ? null : aNumero(limiteTexto);

  const p = errores.length === 0 ? pluma(datos) : null;
  const c = p ? concentracion(datos, p, x, y, z) : null;
  const perfil = p ? perfilSuelo(datos, p, Math.max(10000, x * 3)) : null;
  const avisos: string[] = [];
  if (p && datos.tempGasK <= datos.tempAireK) avisos.push("El gas sale más frío que el aire: la sobreelevación térmica de Holland deja de valer.");
  if (manual) avisos.push("Con σ cargados a mano, el perfil por distancia usa Briggs; el punto x usa tus σ.");
  if (!datos.reflexion) avisos.push("Sin reflexión en el suelo la concentración cerca del suelo queda subestimada (hasta la mitad).");

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
            <p className="spec-label">Chimenea y emisión</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="h" etiqueta="Altura hg" sufijo="m" valor={hTexto} onChange={setH} />
              <CampoNumerico id="d" etiqueta="Diámetro D" sufijo="m" valor={dTexto} onChange={setD} />
              <CampoNumerico id="ts" etiqueta="Temperatura del gas Ts" sufijo="K" valor={tsTexto} onChange={setTs} />
              <CampoNumerico id="vs" etiqueta="Velocidad del gas vs" sufijo="m/s" valor={vsTexto} onChange={setVs} />
            </div>
            <CampoSeleccion id="emisionModo" etiqueta="Emisión" valor={porFactor ? "Por factor de emisión" : "Caudal másico"} opciones={["Caudal másico", "Por factor de emisión"]} onChange={setEmisionModo} />
            {porFactor ? (
              <div className="grid grid-cols-3 gap-3">
                <CampoNumerico id="consumo" etiqueta="Consumo de combustible" sufijo="kg/h" valor={consumoTexto} onChange={setConsumo} />
                <CampoNumerico id="fe" etiqueta="Factor de emisión" valor={feTexto} onChange={setFe} />
                <CampoSeleccion id="feUnidad" etiqueta="Unidad" valor={feUnidad === "kg/t" ? "kg/t" : "lb/t"} opciones={["lb/t", "kg/t"]} onChange={setFeUnidad} />
              </div>
            ) : (
              <CampoNumerico id="q" etiqueta="Caudal másico Q" sufijo="µg/s" valor={qTexto} onChange={setQ} />
            )}
            {porFactor && Number.isFinite(emision) && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Q = {fmt(aNumero(consumoTexto), 1)} kg/h / 3600 · {fmt(feKgT / 1000, 6)} kg/kg = {cientifica(emision)} µg/s (AP-42: leña en estufa
                convencional ≈ 34,6 lb PM10/t; alto rendimiento ≈ 16,2).
              </p>
            )}
          </div>
          <div className="space-y-4">
            <p className="spec-label">Atmósfera y viento</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="ta" etiqueta="Temperatura del aire Ta" sufijo="K" valor={taTexto} onChange={setTa} />
              <CampoNumerico id="p" etiqueta="Presión" sufijo="mb" valor={pTexto} onChange={setP} />
              <CampoSeleccion id="estabilidad" etiqueta="Estabilidad (Pasquill)" valor={est} opciones={ESTABILIDADES} onChange={setEstabilidad} />
              <CampoSeleccion id="superficie" etiqueta="Superficie" valor={sup} opciones={["urbana", "rural"]} onChange={setSuperficie} />
              <CampoNumerico id="h1" etiqueta="Altura del anemómetro" sufijo="m" valor={h1Texto} onChange={setH1} />
              <CampoNumerico id="u1" etiqueta="Viento medido" sufijo="m/s" valor={u1Texto} onChange={setU1} />
              <CampoNumerico id="n" etiqueta="Exponente n (opcional)" valor={nTexto} onChange={setN} advertencia={`Vacío: ${fmt(EXPONENTE_VIENTO[sup as "urbana"][est], 2)} (${sup}, ${est}).`} />
              <CampoNumerico id="holland" etiqueta="Coef. de Holland" valor={hollandTexto} onChange={setHolland} advertencia="2,68×10⁻³ en la fórmula original." />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">{DESCRIPCION_ESTABILIDAD[est]}.</p>
          </div>
          <div className="space-y-4">
            <p className="spec-label">Receptor</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="x" etiqueta="x (a favor del viento)" sufijo="m" valor={xTexto} onChange={setX} />
              <CampoNumerico id="y" etiqueta="y (transversal)" sufijo="m" valor={yTexto} onChange={setY} />
              <CampoNumerico id="z" etiqueta="z (altura)" sufijo="m" valor={zTexto} onChange={setZ} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CampoSeleccion id="sigmaModo" etiqueta="σy y σz" valor={manual ? "Cargados a mano" : "Briggs (fórmulas)"} opciones={["Briggs (fórmulas)", "Cargados a mano"]} onChange={setSigmaModo} />
              <CampoSeleccion id="reflexion" etiqueta="Reflexión en el suelo" valor={reflexion === "No" ? "No" : "Sí"} opciones={["Sí", "No"]} onChange={setReflexion} />
            </div>
            {manual && (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="sy" etiqueta="σy en x" sufijo="m" valor={syTexto} onChange={setSy} advertencia="Leído de las curvas de Pasquill-Gifford." />
                <CampoNumerico id="sz" etiqueta="σz en x" sufijo="m" valor={szTexto} onChange={setSz} />
              </div>
            )}
            <CampoNumerico id="limite" etiqueta="Valor de referencia (opcional)" sufijo="µg/m³" valor={limiteTexto} onChange={setLimite} advertencia="Para marcarlo en el gráfico. Ojo: el modelo da promedios de ~10 min a 1 h." />
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {p && c && perfil && (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Concentración en el receptor", valor: cientifica(c.c), nota: "µg/m³", destacada: true },
                  { etiqueta: "Altura efectiva H", valor: `${fmt(p.alturaEfectiva, 2)} m`, nota: `Δh = ${fmt(p.sobreelevacion, 3)} m` },
                  { etiqueta: "Viento en H", valor: `${fmt(p.vientoEfectivo, 2)} m/s`, nota: `n = ${fmt(p.n, 2)}` },
                  { etiqueta: "Máximo a nivel del suelo", valor: cientifica(perfil.maximo.c), nota: `a ${fmt(perfil.maximo.x, 0)} m (Briggs, eje)` },
                ]}
              />
              <ListaAvisos avisos={avisos} />
              <GraficoLineas
                titulo="Concentración a nivel del suelo sobre el eje de la pluma"
                series={[{ id: "c", nombre: "C(x, 0, 0)", color: "var(--serie-1)", puntos: perfil.perfil.map((q) => ({ x: Math.log10(q.x), y: q.c })) }]}
                destacados={[{ x: Math.log10(perfil.maximo.x), y: perfil.maximo.c, etiqueta: `máx. ${cientifica(perfil.maximo.c)}`, color: "var(--serie-2)" }]}
                referenciasY={limite !== null && Number.isFinite(limite) ? [{ y: limite, etiqueta: "referencia" }] : []}
                ticksX={[50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].filter((v) => v <= Math.max(10000, x * 3)).map(Math.log10)}
                formatoX={(v) => fmt(10 ** v, 0)}
                formatoY={(v) => cientifica(v, 2)}
                formatoXTooltip={(v) => `x = ${fmt(10 ** v, 0)} m`}
                formatoValor={(v) => `${cientifica(v)} µg/m³`}
                ejeX="Distancia a favor del viento (m, escala log)"
                ejeY="µg/m³"
                desdeCero
              />
              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  { etiqueta: "u en la chimenea", formula: "u1·(hg/z1)^n", sustitucion: `${fmt(datos.vientoRefMs, 2)}·(${fmt(datos.alturaM, 1)}/${fmt(datos.alturaRefM, 1)})^${fmt(p.n, 2)}`, valor: `${fmt(p.vientoChimenea, 4)} m/s` },
                  {
                    etiqueta: "Δh (Holland)",
                    formula: "(vs·D/u)·[1,5 + c·p·D·(Ts − Ta)/Ts]",
                    sustitucion: `(${fmt(datos.velocidadGasMs, 2)}·${fmt(datos.diametroM, 2)}/${fmt(p.vientoChimenea, 3)})·[1,5 + ${fmt(datos.coefHolland * 1000, 3)}×10⁻³·${fmt(datos.presionMb, 0)}·${fmt(datos.diametroM, 2)}·(${fmt(datos.tempGasK, 0)} − ${fmt(datos.tempAireK, 0)})/${fmt(datos.tempGasK, 0)}]`,
                    valor: `${fmt(p.sobreelevacion, 4)} m`,
                  },
                  { etiqueta: "H", formula: "hg + Δh", sustitucion: `${fmt(datos.alturaM, 2)} + ${fmt(p.sobreelevacion, 4)}`, valor: `${fmt(p.alturaEfectiva, 4)} m` },
                  { etiqueta: "u en H", formula: "u1·(H/z1)^n", valor: `${fmt(p.vientoEfectivo, 4)} m/s` },
                  {
                    etiqueta: "σy, σz",
                    formula: manual ? "cargados a mano" : `Briggs ${sup}, clase ${est}`,
                    sustitucion: manual ? undefined : `x = ${fmt(x, 0)} m`,
                    valor: `${fmt(c.sy, 2)} m, ${fmt(c.sz, 2)} m`,
                  },
                  {
                    etiqueta: "C",
                    formula: `Q/(2π·u·σy·σz)·e^(−y²/2σy²)·[e^(−(z−H)²/2σz²)${datos.reflexion ? " + e^(−(z+H)²/2σz²)" : ""}]`,
                    sustitucion: `${cientifica(datos.emisionUgS)}/(2π·${fmt(p.vientoEfectivo, 3)}·${fmt(c.sy, 2)}·${fmt(c.sz, 2)})·…`,
                    valor: `${cientifica(c.c, 4)} µg/m³`,
                  },
                  ...(!manual ? [] : [{ etiqueta: "σ de Briggs en x (comparación)", valor: `${fmt(sigmasBriggs(x, est, sup).sy, 1)} m, ${fmt(sigmasBriggs(x, est, sup).sz, 1)} m` }]),
                ]}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
