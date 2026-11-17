"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaCanal } from "@/components/calculadoras/croquis/DiagramaCanal";
import { calcularCanalManning, type FormaCanal } from "@/lib/calc/hidraulica/canales-manning";
import { MATERIALES_CANAL } from "@/lib/calc/hidraulica/materiales";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("canales-manning");

const NOMBRE_FORMA: Record<string, FormaCanal> = {
  Rectangular: "rectangular",
  Trapecial: "trapecial",
  Triangular: "triangular",
};

const ETIQUETA_FORMA: Record<FormaCanal, string> = {
  rectangular: "Rectangular",
  trapecial: "Trapecial",
  triangular: "Triangular",
};

const NOMBRE_REGIMEN = {
  subcritico: "Subcrítico",
  critico: "Crítico",
  supercritico: "Supercrítico",
} as const;

function textoDe(n: number): string {
  return String(n).replace(".", ",");
}

export default function CanalesManningPage() {
  const [formaNombre, setFormaNombre] = useCampo("forma", "Trapecial");
  const [materialId, setMaterialId] = useCampo("material", "hormigon-bruto");
  const [caudalTexto, setCaudal] = useCampo("caudal", "1,5");
  const [baseTexto, setBase] = useCampo("base", "1");
  const [taludTexto, setTalud] = useCampo("talud", "1");
  const [nTexto, setN] = useCampo("n", "0,015");
  const [pendienteTexto, setPendiente] = useCampo("pendiente", "0,5");

  const forma = NOMBRE_FORMA[formaNombre] ?? "trapecial";
  const material = MATERIALES_CANAL.find((m) => m.id === materialId) ?? MATERIALES_CANAL[0];

  const cambiarMaterial = (nombre: string) => {
    const m = MATERIALES_CANAL.find((x) => x.nombre === nombre);
    if (!m) return;
    setMaterialId(m.id);
    setN(textoDe(m.n));
  };

  const caudalM3s = aNumero(caudalTexto);
  const baseM = aNumero(baseTexto);
  const taludZ = aNumero(taludTexto);
  const n = aNumero(nTexto);
  // La pendiente se escribe en por mil (‰), como se cotiza en obra, y se pasa a m/m para la fórmula.
  const pendientePorMil = aNumero(pendienteTexto);
  const pendiente = pendientePorMil / 1000;

  const datosValidos =
    Number.isFinite(caudalM3s) &&
    caudalM3s > 0 &&
    (forma === "triangular" || (Number.isFinite(baseM) && baseM > 0)) &&
    (forma === "rectangular" || (Number.isFinite(taludZ) && taludZ > 0)) &&
    Number.isFinite(n) &&
    n > 0 &&
    Number.isFinite(pendiente) &&
    pendiente > 0;

  const resultado = datosValidos
    ? calcularCanalManning({
        forma,
        caudalM3s,
        baseM: forma === "triangular" ? 0 : baseM,
        taludZ: forma === "rectangular" ? 0 : taludZ,
        n,
        pendiente,
      })
    : null;

  const formulaGeometria =
    forma === "rectangular"
      ? { etiqueta: "A = b·y, P = b + 2y", sustitucion: `A = ${fmt(baseM, 2)}·y, P = ${fmt(baseM, 2)} + 2y` }
      : forma === "triangular"
        ? { etiqueta: "A = z·y², P = 2y√(1+z²)", sustitucion: `A = ${fmt(taludZ, 2)}·y², P = 2y√(1+${fmt(taludZ, 2)}²)` }
        : {
            etiqueta: "A = (b+zy)·y, P = b + 2y√(1+z²)",
            sustitucion: `A = (${fmt(baseM, 2)}+${fmt(taludZ, 2)}y)·y, P = ${fmt(baseM, 2)} + 2y√(1+${fmt(taludZ, 2)}²)`,
          };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo="Manning" onMetodoChange={() => {}} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Sección</p>
            <CampoSeleccion
              id="forma"
              etiqueta="Forma del canal"
              valor={ETIQUETA_FORMA[forma]}
              opciones={["Rectangular", "Trapecial", "Triangular"]}
              onChange={setFormaNombre}
            />
            <div className="grid grid-cols-2 gap-4">
              {forma !== "triangular" && (
                <CampoNumerico id="base" etiqueta="Ancho de solera b" sufijo="m" valor={baseTexto} onChange={setBase} />
              )}
              {forma !== "rectangular" && (
                <CampoNumerico
                  id="talud"
                  etiqueta="Talud z (1V : zH)"
                  valor={taludTexto}
                  onChange={setTalud}
                  advertencia="Horizontal por cada unidad de vertical. z=1 es 45°."
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Material y pendiente</p>
            <CampoSeleccion
              id="material"
              etiqueta="Revestimiento"
              valor={material.nombre}
              opciones={MATERIALES_CANAL.map((m) => m.nombre)}
              onChange={cambiarMaterial}
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="n"
                etiqueta="Coeficiente de Manning n"
                valor={nTexto}
                onChange={setN}
                advertencia="Se completa solo al elegir el revestimiento; se puede ajustar a mano."
              />
              <CampoNumerico id="pendiente" etiqueta="Pendiente de fondo S" sufijo="‰" valor={pendienteTexto} onChange={setPendiente} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Caudal de diseño</p>
            <CampoNumerico id="caudal" etiqueta="Caudal Q" sufijo="m³/s" valor={caudalTexto} onChange={setCaudal} />
          </div>
        </div>

        <div className="space-y-6">
          {!resultado ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              Completá la geometría, el revestimiento, la pendiente y el caudal de diseño para
              calcular el tirante normal.
            </div>
          ) : (
            <>
              <DiagramaCanal
                forma={forma}
                tiranteM={resultado.tiranteM}
                baseM={forma === "triangular" ? 0 : baseM}
                taludZ={forma === "rectangular" ? 0 : taludZ}
                anchoSuperficialM={resultado.anchoSuperficialM}
              />

              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Tirante normal y", valor: `${fmt(resultado.tiranteM, 3)} m`, destacada: true },
                  { etiqueta: "Velocidad", valor: `${fmt(resultado.velocidadMs, 3)} m/s` },
                  { etiqueta: "Radio hidráulico", valor: `${fmt(resultado.radioHidraulicoM, 3)} m` },
                  {
                    etiqueta: "Froude",
                    valor: fmt(resultado.froude, 2),
                    nota: NOMBRE_REGIMEN[resultado.regimen],
                  },
                ]}
              />

              <PanelFormulas
                titulo="Ver cálculo"
                filas={[
                  {
                    etiqueta: formulaGeometria.etiqueta,
                    formula: "con y resuelto por iteración",
                    sustitucion: formulaGeometria.sustitucion,
                    valor: `A = ${fmt(resultado.areaM2, 3)} m², P = ${fmt(resultado.perimetroMojadoM, 3)} m`,
                  },
                  {
                    etiqueta: "R = A/P",
                    formula: "A/P",
                    sustitucion: `${fmt(resultado.areaM2, 3)} / ${fmt(resultado.perimetroMojadoM, 3)}`,
                    valor: `${fmt(resultado.radioHidraulicoM, 3)} m`,
                  },
                  {
                    etiqueta: "Q = (1/n)·A·R^(2/3)·√S",
                    formula: "(1/n)·A·R^(2/3)·√S",
                    sustitucion: `(1/${fmt(n, 3)}) · ${fmt(resultado.areaM2, 3)} · ${fmt(resultado.radioHidraulicoM, 3)}^(2/3) · √${fmt(pendiente, 4)}`,
                    valor: `${fmt(caudalM3s, 3)} m³/s (caudal de diseño)`,
                  },
                  {
                    etiqueta: "V = Q/A",
                    formula: "Q/A",
                    sustitucion: `${fmt(caudalM3s, 3)} / ${fmt(resultado.areaM2, 3)}`,
                    valor: `${fmt(resultado.velocidadMs, 3)} m/s`,
                  },
                  {
                    etiqueta: "Fr = V/√(g·A/T)",
                    formula: "V/√(g·A/T)",
                    sustitucion: `${fmt(resultado.velocidadMs, 3)} / √(9,81·${fmt(resultado.areaM2, 3)}/${fmt(resultado.anchoSuperficialM, 3)})`,
                    valor: fmt(resultado.froude, 3),
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
