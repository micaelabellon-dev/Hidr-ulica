"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaGolpe } from "@/components/calculadoras/croquis/DiagramaGolpe";
import { GraficoLineas } from "@/components/calculadoras/graficos/GraficoLineas";
import { calcularGolpe, MATERIALES_GOLPE, sobrepresionEnX } from "@/lib/calc/hidraulica/golpe-ariete";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("golpe-ariete");

export default function GolpeArietePage() {
  const [caudalTexto, setCaudal] = useCampo("caudal", "12,5");
  const [dnTexto, setDn] = useCampo("dn", "160");
  const [espesorTexto, setEspesor] = useCampo("espesor", "9,5");
  const [longitudTexto, setLongitud] = useCampo("longitud", "380");
  const [materialId, setMaterialId] = useCampo("material", "pead");
  const [moduloTexto, setModulo] = useCampo("modulo", "9000");
  const [hServicioTexto, setHServicio] = useCampo("hServicio", "15,97");
  const [hEstaticaTexto, setHEstatica] = useCampo("hEstatica", "4,36");
  const [modoTiempo, setModoTiempo] = useCampo("modoTiempo", "Mendiluce (parada de bomba)");
  const [tiempoTexto, setTiempo] = useCampo("tiempo", "10");
  const [gTexto, setG] = useCampo("g", "9,81");
  const [pnTexto, setPn] = useCampo("pn", "6");

  const material = MATERIALES_GOLPE.find((m) => m.id === materialId) ?? MATERIALES_GOLPE[0];
  const cambiarMaterial = (nombre: string) => {
    const m = MATERIALES_GOLPE.find((x) => x.nombre === nombre);
    if (!m) return;
    setMaterialId(m.id);
    setModulo(String(m.moduloKpCm2).replace(".", ","));
  };

  const errores: string[] = [];
  const num = (t: string, nombre: string) => {
    const v = aNumero(t);
    if (!Number.isFinite(v) || v <= 0) errores.push(`${nombre} tiene que ser un número mayor que cero.`);
    return v;
  };
  const manual = modoTiempo === "Tiempo cargado a mano";
  const datos = {
    caudalLs: num(caudalTexto, "El caudal"),
    diametroExteriorMm: num(dnTexto, "El diámetro exterior"),
    espesorMm: num(espesorTexto, "El espesor"),
    longitudM: num(longitudTexto, "La longitud"),
    moduloKpCm2: num(moduloTexto, "El módulo de elasticidad"),
    alturaManometricaM: num(hServicioTexto, "La altura manométrica"),
    tiempoCierreS: manual ? num(tiempoTexto, "El tiempo de cierre") : null,
    g: num(gTexto, "La gravedad"),
    presionNominalM: pnTexto.trim() === "" ? null : num(pnTexto, "La presión nominal") * 10.197,
  };
  const hEstatica = aNumero(hEstaticaTexto);
  if (!Number.isFinite(hEstatica)) errores.push("La altura estática no es un número.");
  if (datos.espesorMm * 2 >= datos.diametroExteriorMm) errores.push("El espesor es demasiado grande para ese diámetro.");

  const r = errores.length === 0 ? calcularGolpe(datos) : null;

  const L = datos.longitudM;
  const xs = Array.from({ length: 61 }, (_, i) => (L * i) / 60);
  // Línea piezométrica de régimen: de H_m en la bomba a la estática en el depósito.
  const hRegimen = (x: number) => datos.alturaManometricaM - (datos.alturaManometricaM - hEstatica) * (x / L);

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
            <p className="spec-label">Impulsión</p>
            <CampoSeleccion id="material" etiqueta="Material" valor={material.nombre} opciones={MATERIALES_GOLPE.map((m) => m.nombre)} onChange={cambiarMaterial} />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="dn" etiqueta="Diámetro exterior" sufijo="mm" valor={dnTexto} onChange={setDn} />
              <CampoNumerico id="espesor" etiqueta="Espesor de pared" sufijo="mm" valor={espesorTexto} onChange={setEspesor} />
              <CampoNumerico id="longitud" etiqueta="Longitud" sufijo="m" valor={longitudTexto} onChange={setLongitud} />
              <CampoNumerico
                id="modulo"
                etiqueta="Módulo de elasticidad E"
                sufijo="kp/cm²"
                valor={moduloTexto}
                onChange={setModulo}
                advertencia="Se completa al elegir el material."
              />
              <CampoNumerico id="pn" etiqueta="Presión nominal PN" sufijo="bar" valor={pnTexto} onChange={setPn} advertencia="Vacío para no verificar." />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Funcionamiento</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="caudal" etiqueta="Caudal" sufijo="L/s" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico id="g" etiqueta="Gravedad g" sufijo="m/s²" valor={gTexto} onChange={setG} />
              <CampoNumerico id="hServicio" etiqueta="Altura manométrica Hm" sufijo="m" valor={hServicioTexto} onChange={setHServicio} />
              <CampoNumerico id="hEstatica" etiqueta="Altura estática" sufijo="m" valor={hEstaticaTexto} onChange={setHEstatica} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Se pueden traer desde la calculadora de bombeo con «Verificar golpe de ariete». La estática sólo se usa para dibujar
              la línea piezométrica.
            </p>
            <CampoSeleccion
              id="modoTiempo"
              etiqueta="Tiempo de parada o cierre"
              valor={manual ? "Tiempo cargado a mano" : "Mendiluce (parada de bomba)"}
              opciones={["Mendiluce (parada de bomba)", "Tiempo cargado a mano"]}
              onChange={setModoTiempo}
            />
            {manual && <CampoNumerico id="tiempo" etiqueta="Tiempo T" sufijo="s" valor={tiempoTexto} onChange={setTiempo} />}
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {!r ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">Completá los datos de la impulsión.</div>
          ) : (
            <>
              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Celeridad c", valor: `${fmt(r.celeridadMs, 1)} m/s`, nota: `fase 2L/c = ${fmt(r.tiempoFaseS, 2)} s` },
                  {
                    etiqueta: "Tiempo T",
                    valor: `${fmt(r.tiempoCierreS, 2)} s`,
                    nota: `${r.regimen === "rapido" ? "cierre rápido" : "cierre lento"} · Lc = ${fmt(r.longitudCriticaM, 0)} m`,
                  },
                  {
                    etiqueta: "Sobrepresión ΔH",
                    valor: `${fmt(r.sobrepresionM, 2)} m`,
                    nota: r.regimen === "rapido" ? "Joukowsky (c·V/g)" : "Michaud (2LV/gT)",
                    destacada: true,
                  },
                  {
                    etiqueta: "Presión máx. / mín.",
                    valor: `${fmt(r.presionMaximaM, 1)} / ${fmt(r.presionMinimaM, 1)}`,
                    nota: `m.c.a. en la bomba${datos.presionNominalM ? ` · PN = ${fmt(datos.presionNominalM, 0)} m` : ""}`,
                  },
                ]}
              />
              <ListaAvisos avisos={r.avisos} />

              <DiagramaGolpe
                longitudM={L}
                alturaManometricaM={datos.alturaManometricaM}
                alturaEstaticaM={hEstatica}
                deltaEn={(x) => sobrepresionEnX(r, L, x)}
                sobrepresionM={r.sobrepresionM}
                longitudCriticaM={r.longitudCriticaM}
                regimen={r.regimen}
                celeridadMs={r.celeridadMs}
                presionNominalM={datos.presionNominalM}
                diametroExteriorMm={datos.diametroExteriorMm}
                espesorMm={datos.espesorMm}
                diametroInteriorMm={r.diametroInteriorMm}
              />

              <GraficoLineas
                titulo="Envolvente de alturas piezométricas a lo largo de la impulsión"
                series={[
                  {
                    id: "max",
                    nombre: "Máxima (régimen + ΔH)",
                    color: "var(--serie-2)",
                    puntos: xs.map((x) => ({ x, y: hRegimen(x) + sobrepresionEnX(r, L, x) })),
                  },
                  { id: "reg", nombre: "Régimen permanente", color: "var(--serie-1)", puntos: xs.map((x) => ({ x, y: hRegimen(x) })) },
                  {
                    id: "min",
                    nombre: "Mínima (régimen − ΔH)",
                    color: "var(--serie-3)",
                    discontinua: true,
                    puntos: xs.map((x) => ({ x, y: hRegimen(x) - sobrepresionEnX(r, L, x) })),
                  },
                ]}
                referenciasY={[
                  ...(datos.presionNominalM ? [{ y: datos.presionNominalM, etiqueta: `PN ${fmt(datos.presionNominalM / 10.197, 0)} bar` }] : []),
                  { y: 0, etiqueta: "eje de la tubería" },
                ]}
                formatoX={(x) => fmt(x, 0)}
                formatoY={(y) => fmt(y, 0)}
                formatoXTooltip={(x) => `a ${fmt(x, 0)} m de la bomba`}
                formatoValor={(y) => `${fmt(y, 2)} m`}
                ejeX="Distancia desde la bomba (m)"
                ejeY="Altura piezométrica (m)"
              />
              <p className="-mt-4 text-[11px] text-muted-foreground">
                Supone la impulsión recta y horizontal desde la bomba hasta la descarga. Con el perfil real, la presión sobre la
                tubería es esta altura menos la cota del terreno en cada punto: revisá los puntos altos.
              </p>

              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  { etiqueta: "D interior", formula: "DN − 2e", sustitucion: `${fmt(datos.diametroExteriorMm, 1)} − 2·${fmt(datos.espesorMm, 2)}`, valor: `${fmt(r.diametroInteriorMm, 1)} mm` },
                  { etiqueta: "V", formula: "Q / (π·D²/4)", sustitucion: `${fmt(datos.caudalLs / 1000, 4)} / (π·${fmt(r.diametroInteriorMm / 1000, 4)}²/4)`, valor: `${fmt(r.velocidadMs, 3)} m/s` },
                  { etiqueta: "k", formula: "10¹⁰ / E", sustitucion: `10¹⁰ / (${fmt(datos.moduloKpCm2, 0)} · 10⁴)`, valor: fmt(r.coefK, 3) },
                  {
                    etiqueta: "c (Allievi)",
                    formula: "9900 / √(48,3 + k·D/e)",
                    sustitucion: `9900 / √(48,3 + ${fmt(r.coefK, 3)} · ${fmt(r.diametroInteriorMm, 1)}/${fmt(datos.espesorMm, 2)})`,
                    valor: `${fmt(r.celeridadMs, 2)} m/s`,
                  },
                  { etiqueta: "Fase", formula: "2L / c", sustitucion: `2 · ${fmt(L, 1)} / ${fmt(r.celeridadMs, 2)}`, valor: `${fmt(r.tiempoFaseS, 3)} s` },
                  {
                    etiqueta: "T (Mendiluce)",
                    formula: "C + K·L·V / (g·Hm)",
                    sustitucion: `${fmt(r.mendiluce.C, 2)} + ${fmt(r.mendiluce.K, 2)} · ${fmt(L, 1)} · ${fmt(r.velocidadMs, 3)} / (${fmt(datos.g, 2)} · ${fmt(datos.alturaManometricaM, 2)})   (Hm/L = ${fmt(datos.alturaManometricaM / L, 3)})`,
                    valor: `${fmt(r.mendiluce.tiempoS, 3)} s${manual ? " (no se usa: T cargado a mano)" : ""}`,
                  },
                  { etiqueta: "Lc", formula: "c · T / 2", sustitucion: `${fmt(r.celeridadMs, 2)} · ${fmt(r.tiempoCierreS, 3)} / 2`, valor: `${fmt(r.longitudCriticaM, 1)} m` },
                  {
                    etiqueta: "ΔH Joukowsky",
                    formula: "c · V / g",
                    sustitucion: `${fmt(r.celeridadMs, 2)} · ${fmt(r.velocidadMs, 3)} / ${fmt(datos.g, 2)}`,
                    valor: `${fmt(r.sobrepresionJoukowskyM, 3)} m`,
                  },
                  {
                    etiqueta: "ΔH Michaud",
                    formula: "2 · L · V / (g · T)",
                    sustitucion: `2 · ${fmt(L, 1)} · ${fmt(r.velocidadMs, 3)} / (${fmt(datos.g, 2)} · ${fmt(r.tiempoCierreS, 3)})`,
                    valor: `${fmt(r.sobrepresionMichaudM, 3)} m`,
                  },
                  {
                    etiqueta: "Régimen",
                    formula: "T < 2L/c → rápido (Joukowsky); si no, lento (Michaud)",
                    sustitucion: `${fmt(r.tiempoCierreS, 3)} ${r.regimen === "rapido" ? "<" : "≥"} ${fmt(r.tiempoFaseS, 3)}`,
                    valor: r.regimen === "rapido" ? "rápido" : "lento",
                  },
                  {
                    etiqueta: "H máx / mín",
                    formula: "Hm ± ΔH",
                    sustitucion: `${fmt(datos.alturaManometricaM, 2)} ± ${fmt(r.sobrepresionM, 3)}`,
                    valor: `${fmt(r.presionMaximaM, 2)} / ${fmt(r.presionMinimaM, 2)} m`,
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
