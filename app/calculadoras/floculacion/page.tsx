"use client";

import { useMemo } from "react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import { ajusteGT, floculadorPaletas, floculadorTabiques, gradienteTuberia } from "@/lib/calc/potabilizacion/floculacion";
import { numeroDeCelda } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("floculacion");

const JARRAS: string[][] = [
  ["5", "37"],
  ["10", "28"],
  ["15", "20"],
  ["20", "20"],
  ["25", "12"],
  ["30", "12"],
];
/** Cámaras: área (m²), Lx (m), ancho de paleta a (m), tiempo para G (min). */
const CAMARAS: string[][] = [
  ["4,16", "3,36", "0,1", "5"],
  ["7", "3,36", "0,2", "10"],
  ["9", "3,36", "0,3", "15"],
];
/** Tramos: separación entre tabiques (m), tiempo (min). */
const TRAMOS: string[][] = [
  ["0,1", "10"],
  ["0,13", "20"],
];

function leerTabla(filas: string[][], cols: number, nombres: string[], errores: string[]): number[][] {
  const out: number[][] = [];
  filas.forEach((f, i) => {
    if (!f.some((c) => (c ?? "").trim() !== "")) return;
    const v = Array.from({ length: cols }, (_, j) => {
      const n = numeroDeCelda(f[j] ?? "");
      if (n === null || Number.isNaN(n) || n <= 0) errores.push(`Fila ${i + 1}: ${nombres[j]} tiene que ser un número mayor que cero.`);
      return n ?? NaN;
    });
    out.push(v);
  });
  return out;
}

export default function FloculacionPage() {
  const [metodo, setMetodo] = useCampo("metodo", "Paletas (mecánico)");
  const [qTexto, setQ] = useCampo("q", "28");
  const [jarras, setJarras] = useTabla("jarras", JARRAS);
  const [camaras, setCamaras] = useTabla("camaras", CAMARAS);
  const [tramos, setTramos] = useTabla("tramos", TRAMOS);
  const [hTexto, setH] = useCampo("h", "2,5");
  const [dDeTexto, setDDe] = useCampo("dDe", "0,4");
  const [kTexto, setK] = useCampo("k", "0,05");
  const [nqTexto, setNq] = useCampo("nq", "0,86");
  const [hTabTexto, setHTab] = useCampo("hTab", "1,5");
  const [anchoTexto, setAncho] = useCampo("ancho", "3,36");
  const [manningTexto, setManning] = useCampo("manning", "0,011");
  const [kGiroTexto, setKGiro] = useCampo("kGiro", "3,2");
  const [dSalidaTexto, setDSalida] = useCampo("dSalida", "396,87");
  const [nSalidaTexto, setNSalida] = useCampo("nSalida", "0,012");

  const errores: string[] = [];
  const erroresJarras: string[] = [];
  const num = (t: string, nombre: string, permitirCero = false) => {
    const x = aNumero(t);
    if (!Number.isFinite(x) || (permitirCero ? x < 0 : x <= 0)) errores.push(`${nombre} tiene que ser un número ${permitirCero ? "≥ 0" : "mayor que cero"}.`);
    return x;
  };
  const Q = num(qTexto, "El caudal") / 1000;
  const nu = 1e-6;
  const j = useMemo(() => {
    const e: string[] = [];
    const v = leerTabla(jarras, 2, ["el tiempo", "G"], e);
    return { v, e };
  }, [jarras]);
  erroresJarras.push(...j.e);
  const ajuste = erroresJarras.length === 0 && j.v.length >= 2 ? ajusteGT(j.v.map((x) => x[0] * 60), j.v.map((x) => x[1])) : null;
  const metodoActual = metodo.startsWith("Tabiques") ? (metodo.includes("vertical") ? "vertical" : "horizontal") : "paletas";
  const avisos: string[] = [];
  let contenido: React.ReactNode = null;
  let gUltimo = NaN;

  if (metodoActual === "paletas") {
    const erroresCam: string[] = [];
    const cams = leerTabla(camaras, 4, ["el área", "Lx", "el ancho de paleta", "el tiempo"], erroresCam);
    errores.push(...erroresCam);
    if (!ajuste) errores.push("Hace falta el ajuste G·Tⁿ = K (al menos dos ensayos) para el G de cada cámara.");
    const datos = {
      caudalM3s: Q,
      alturaM: num(hTexto, "La altura"),
      relacionDDe: num(dDeTexto, "D/De"),
      k: num(kTexto, "k", true),
      nu,
      nq: num(nqTexto, "Nq"),
      camaras: ajuste ? cams.map(([areaM2, lxM, anchoPaletaM, tMin]) => ({ areaM2, lxM, anchoPaletaM, gObjetivo: ajuste.K * (tMin * 60) ** -ajuste.n })) : [],
    };
    const r = errores.length === 0 ? floculadorPaletas(datos) : null;
    if (r) {
      gUltimo = r[r.length - 1]?.gObjetivo ?? NaN;
      const tTotal = r[r.length - 1]?.tAcum ?? 0;
      r.forEach((c, i) => {
        if (c.vPaleta > 0.75) avisos.push(`Cámara ${i + 1}: velocidad de paleta ${fmt(c.vPaleta, 2)} m/s, mayor que 0,75 m/s (rompe flóculos).`);
      });
      if (tTotal < 15 * 60 || tTotal > 40 * 60) avisos.push(`Tiempo total ${fmt(tTotal / 60, 1)} min, fuera de 15–40 min.`);
      if (r.length < 3) avisos.push("Menos de 3 cámaras en serie: riesgo de cortocircuitos.");
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Volumen total", valor: `${fmt(r.reduce((s, c) => s + c.volumen, 0), 1)} m³` },
              { etiqueta: "Tiempo total", valor: `${fmt(tTotal / 60, 1)} min`, destacada: true },
              { etiqueta: "G·T (Camp)", valor: fmt(r.reduce((s, c) => s + c.gObjetivo * c.tiempo, 0), 0), nota: "10⁴ a 10⁵" },
              { etiqueta: "Cámaras", valor: String(r.length) },
            ]}
          />
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
              <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                <tr>{["Cámara", "V (m³)", "t (min)", "G (s⁻¹)", "D (m)", "b/a", "Cd", "rpm", "v paleta", "Q bombeo"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {r.map((c, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-2 py-1">{i + 1}</td>
                    <td className="px-2 py-1">{fmt(c.volumen, 1)}</td>
                    <td className="px-2 py-1">{fmt(c.tiempo / 60, 1)}</td>
                    <td className="px-2 py-1">{fmt(c.gObjetivo, 1)}</td>
                    <td className="px-2 py-1">{fmt(c.D, 3)}</td>
                    <td className="px-2 py-1">{fmt(c.relacion, 2)}</td>
                    <td className="px-2 py-1">{fmt(c.cd, 3)}</td>
                    <td className="px-2 py-1 font-semibold">{fmt(c.rpm, 2)}</td>
                    <td className="px-2 py-1">{fmt(c.vPaleta, 3)} m/s</td>
                    <td className="px-2 py-1">{fmt(c.qBombeo * 1000, 1)} L/s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelFormulas
            titulo="Ver cálculo · cámara 1"
            filas={r[0] ? [
              { etiqueta: "G objetivo", formula: "K · t^(−n)", sustitucion: `${fmt(ajuste!.K, 1)} · (${fmt(cams[0][3] * 60, 0)} s)^(−${fmt(ajuste!.n, 3)})`, valor: `${fmt(r[0].gObjetivo, 2)} s⁻¹` },
              { etiqueta: "De", formula: "1,13·√(Lx·Ly)", sustitucion: `1,13·√(${fmt(r[0].lxM, 2)}·${fmt(r[0].ly, 3)})`, valor: `${fmt(r[0].de, 3)} m` },
              { etiqueta: "D, b", formula: "(D/De)·De ; D/2", valor: `${fmt(r[0].D, 3)} m ; ${fmt(r[0].b, 3)} m` },
              { etiqueta: "Cd", formula: "tabla de Camp (b/a)", sustitucion: `b/a = ${fmt(r[0].relacion, 2)}`, valor: fmt(r[0].cd, 4) },
              { etiqueta: "n", formula: "[(G/0,024)²·ν·V / (Cd·(1−k)³·a·b⁴)]^(1/3)", sustitucion: `[(${fmt(r[0].gObjetivo, 2)}/0,024)²·10⁻⁶·${fmt(r[0].volumen, 2)}/(${fmt(r[0].cd, 3)}·${fmt(1 - datos.k, 2)}³·${fmt(r[0].anchoPaletaM, 2)}·${fmt(r[0].b, 3)}⁴)]^(1/3)`, valor: `${fmt(r[0].rpm, 3)} rpm` },
              { etiqueta: "v paleta", formula: "2π·b·n/60", valor: `${fmt(r[0].vPaleta, 4)} m/s` },
              { etiqueta: "Q bombeo", formula: "Nq·n·D³/60", valor: `${fmt(r[0].qBombeo, 4)} m³/s` },
            ] : []}
          />
        </>
      );
    }
  } else {
    const erroresTr: string[] = [];
    const trs = leerTabla(tramos, 2, ["la separación", "el tiempo"], erroresTr);
    errores.push(...erroresTr);
    const datos = {
      caudalM3s: Q,
      alturaM: num(hTabTexto, "La altura"),
      anchoM: num(anchoTexto, "El ancho"),
      manning: num(manningTexto, "n de Manning"),
      kGiro: num(kGiroTexto, "K de vuelta"),
      nu,
      g: 9.8,
      flujo: metodoActual as "horizontal" | "vertical",
      pasajeFactor: 1.5,
      tramos: trs.map(([separacionM, tMin]) => ({ separacionM, tiempoS: tMin * 60 })),
    };
    const r = errores.length === 0 ? floculadorTabiques(datos) : null;
    if (r) {
      gUltimo = r[r.length - 1]?.G ?? NaN;
      r.forEach((t, i) => {
        if (t.G < 10 || t.G > 80) avisos.push(`Tramo ${i + 1}: G = ${fmt(t.G, 1)} s⁻¹, fuera de 10–80 s⁻¹.`);
        if (t.v < 0.1 || t.v > 0.6) avisos.push(`Tramo ${i + 1}: velocidad ${fmt(t.v, 2)} m/s, fuera de 0,1–0,6 m/s.`);
      });
      contenido = (
        <>
          <PanelMetricas
            horizontal
            metricas={[
              { etiqueta: "Largo total", valor: `${fmt(r.reduce((s, t) => s + t.largo, 0), 2)} m` },
              { etiqueta: "Tiempo total", valor: `${fmt(r.reduce((s, t) => s + t.tiempoS, 0) / 60, 1)} min`, destacada: true },
              { etiqueta: "Pérdida total", valor: `${fmt(r.reduce((s, t) => s + t.hf, 0) * 100, 2)} cm` },
              { etiqueta: "Tramos", valor: String(r.length) },
            ]}
          />
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
              <thead className="bg-muted/40 font-sans text-[11px] text-muted-foreground">
                <tr>{["Tramo", "d (m)", "Largo (m)", "Tabiques", "v (m/s)", "hf canales", "hf vueltas", "G (s⁻¹)"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {r.map((t, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-2 py-1">{i + 1}</td>
                    <td className="px-2 py-1">{fmt(t.separacionM, 3)}</td>
                    <td className="px-2 py-1">{fmt(t.largo, 2)}</td>
                    <td className="px-2 py-1">{fmt(Math.ceil(t.tabiques), 0)}</td>
                    <td className="px-2 py-1">{fmt(t.v, 3)}</td>
                    <td className="px-2 py-1">{fmt(t.hfCanales * 100, 2)} cm</td>
                    <td className="px-2 py-1">{fmt(t.hfVueltas * 100, 2)} cm</td>
                    <td className="px-2 py-1 font-semibold">{fmt(t.G, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelFormulas
            titulo="Ver cálculo · tramo 1"
            filas={r[0] ? [
              { etiqueta: "Largo", formula: "T·Q / (H·B)", sustitucion: `${fmt(r[0].tiempoS, 0)}·${fmt(Q, 4)}/(${fmt(datos.alturaM, 2)}·${fmt(datos.anchoM, 2)})`, valor: `${fmt(r[0].largo, 3)} m → ${fmt(r[0].tabiques, 1)} tabiques` },
              ...(metodoActual === "horizontal"
                ? [
                    { etiqueta: "v", formula: "Q/(d·H)", valor: `${fmt(r[0].v, 4)} m/s` },
                    { etiqueta: "J", formula: "(n·v/Rh^(2/3))²", sustitucion: `Rh = ${fmt(r[0].rh, 4)} m`, valor: fmt(r[0].j, 6) },
                    { etiqueta: "hf canales", formula: "N·Lc·J", sustitucion: `${fmt(r[0].tabiques, 2)}·${fmt(r[0].lc, 3)}·${fmt(r[0].j, 6)}`, valor: `${fmt(r[0].hfCanales, 5)} m` },
                  ]
                : [{ etiqueta: "v", formula: "Q/(d·B)", valor: `${fmt(r[0].v, 4)} m/s` }]),
              { etiqueta: "hf vueltas", formula: "(N − 1)·K·(2v/3)²/2g", sustitucion: `${fmt(r[0].vueltas, 2)}·${fmt(datos.kGiro, 2)}·(2·${fmt(r[0].v, 4)}/3)²/19,6`, valor: `${fmt(r[0].hfVueltas, 5)} m` },
              { etiqueta: "G", formula: "√(g·hf/(ν·T))", sustitucion: `√(9,8·${fmt(r[0].hf, 5)}/(10⁻⁶·${fmt(r[0].tiempoS, 0)}))`, valor: `${fmt(r[0].G, 2)} s⁻¹` },
            ] : []}
          />
        </>
      );
    }
  }

  const salida = Number.isFinite(Q) && aNumero(dSalidaTexto) > 0 && aNumero(nSalidaTexto) > 0 ? gradienteTuberia(Q, aNumero(dSalidaTexto) / 1000, aNumero(nSalidaTexto)) : null;
  if (salida && Number.isFinite(gUltimo) && salida.G > gUltimo) avisos.push(`El G en la tubería hacia el sedimentador (${fmt(salida.G, 1)} s⁻¹) supera al de la última etapa (${fmt(gUltimo, 1)} s⁻¹): puede romper los flóculos.`);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-4xl font-medium">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={metodo} onMetodoChange={setMetodo} />
      </div>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <p className="spec-label">Ensayo de jarras: G·Tⁿ = K</p>
            <CampoNumerico id="q" etiqueta="Caudal" sufijo="L/s" valor={qTexto} onChange={setQ} />
            <TablaEditable id="tabla-jarras" columnas={[{ titulo: "Tiempo", sufijo: "min" }, { titulo: "G óptimo", sufijo: "s⁻¹" }]} filas={jarras} onChange={setJarras} filasConError={filasDeErrores(erroresJarras)} filaNueva={() => ["", ""]} />
            <ListaErrores titulo="Errores en los ensayos" errores={erroresJarras} />
            {ajuste && (
              <p className="rounded-lg border border-primary/40 bg-accent/60 px-3 py-2 text-sm">
                G · T<sup>{fmt(ajuste.n, 3)}</sup> = <span className="font-mono font-semibold">{fmt(ajuste.K, 0)}</span> (T en s) · R² = {fmt(ajuste.r2, 3)}
              </p>
            )}
          </div>
          {metodoActual === "paletas" ? (
            <div className="space-y-3">
              <p className="spec-label">Floculador de paletas</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="h" etiqueta="Altura de agua" sufijo="m" valor={hTexto} onChange={setH} />
                <CampoNumerico id="dDe" etiqueta="D/De" valor={dDeTexto} onChange={setDDe} />
                <CampoNumerico id="k" etiqueta="k (rotación del agua)" valor={kTexto} onChange={setK} />
                <CampoNumerico id="nq" etiqueta="Nq (bombeo)" valor={nqTexto} onChange={setNq} />
              </div>
              <TablaEditable
                id="tabla-camaras"
                columnas={[{ titulo: "Área", sufijo: "m²" }, { titulo: "Lx", sufijo: "m" }, { titulo: "Paleta a", sufijo: "m" }, { titulo: "t para G", sufijo: "min" }]}
                filas={camaras}
                onChange={setCamaras}
                filaNueva={() => ["", "", "", ""]}
              />
              <p className="text-xs text-muted-foreground">El G de cada cámara sale del ajuste con el tiempo indicado (G decreciente de la primera a la última).</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="spec-label">Floculador de tabiques, flujo {metodoActual}</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="hTab" etiqueta="Altura de agua" sufijo="m" valor={hTabTexto} onChange={setHTab} />
                <CampoNumerico id="ancho" etiqueta="Ancho del floculador" sufijo="m" valor={anchoTexto} onChange={setAncho} />
                {metodoActual === "horizontal" && <CampoNumerico id="manning" etiqueta="n de Manning" valor={manningTexto} onChange={setManning} />}
                <CampoNumerico id="kGiro" etiqueta="K por vuelta de 180°" valor={kGiroTexto} onChange={setKGiro} />
              </div>
              <TablaEditable id="tabla-tramos" columnas={[{ titulo: "Separación d", sufijo: "m" }, { titulo: "Tiempo", sufijo: "min" }]} filas={tramos} onChange={setTramos} filaNueva={() => ["", ""]} />
            </div>
          )}
          <div className="space-y-3">
            <p className="spec-label">Salida al sedimentador</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="dSalida" etiqueta="Diámetro de la tubería" sufijo="mm" valor={dSalidaTexto} onChange={setDSalida} />
              <CampoNumerico id="nSalida" etiqueta="n de Manning" valor={nSalidaTexto} onChange={setNSalida} />
            </div>
            {salida && <p className="text-xs text-muted-foreground">v = {fmt(salida.v, 3)} m/s · G = n·√(g/ν)·Rh^−0,667·v^1,5 = {fmt(salida.G, 1)} s⁻¹</p>}
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          <ListaAvisos avisos={avisos} />
          {contenido}
          {ajuste && (
            <GraficoLineas
              titulo="G óptimo según el tiempo de floculación"
              series={[
                { id: "aj", nombre: `G = ${fmt(ajuste.K, 0)}·T^−${fmt(ajuste.n, 3)}`, color: "var(--serie-1)", puntos: Array.from({ length: 40 }, (_, i) => { const t = 2 + i; return { x: t, y: ajuste.K * (t * 60) ** -ajuste.n }; }) },
                { id: "jar", nombre: "Ensayos", color: "var(--serie-2)", soloMarcadores: true, sinTooltip: true, puntos: j.v.map(([t, g]) => ({ x: t, y: g })).sort((a, b) => a.x - b.x) },
              ]}
              formatoX={(x) => fmt(x, 0)}
              formatoY={(y) => fmt(y, 0)}
              formatoXTooltip={(x) => `T = ${fmt(x, 0)} min`}
              formatoValor={(y) => `${fmt(y, 1)} s⁻¹`}
              ejeX="Tiempo (min)"
              ejeY="G (s⁻¹)"
              desdeCero
              alto={200}
            />
          )}
        </div>
      </div>
    </main>
  );
}
