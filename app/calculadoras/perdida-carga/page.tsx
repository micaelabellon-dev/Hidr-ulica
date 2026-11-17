"use client";

import { useCampo } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { DiagramaPerdidaCarga } from "@/components/calculadoras/croquis/DiagramaPerdidaCarga";
import {
  calcularPerdidaCarga,
  type MetodoPerdidaCarga,
  type RegimenFlujo,
} from "@/lib/calc/hidraulica/perdida-carga";
import { viscosidadCinematicaAgua, MATERIALES_TUBERIA } from "@/lib/calc/hidraulica/materiales";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("perdida-carga");

const NOMBRE_METODO: Record<string, MetodoPerdidaCarga> = {
  "Darcy-Weisbach": "darcy-weisbach",
  "Hazen-Williams": "hazen-williams",
};

const NOMBRE_REGIMEN: Record<RegimenFlujo, string> = {
  laminar: "Laminar",
  transicion: "Transición",
  turbulento: "Turbulento",
};

function textoDe(n: number): string {
  return String(n).replace(".", ",");
}

export default function PerdidaCargaPage() {
  const [metodoNombre, setMetodoNombre] = useCampo("metodo", "Darcy-Weisbach");
  const [materialId, setMaterialId] = useCampo("material", "pvc");
  const [caudalLsTexto, setCaudalLs] = useCampo("caudal", "10");
  const [diametroMmTexto, setDiametroMm] = useCampo("diametro", "100");
  const [longitudMTexto, setLongitudM] = useCampo("longitud", "100");
  const [rugosidadMmTexto, setRugosidadMm] = useCampo("rugosidad", "0,0015");
  const [hazenCTexto, setHazenC] = useCampo("hazenC", "150");
  const [temperaturaCTexto, setTemperaturaC] = useCampo("temperatura", "20");
  const [sumaKTexto, setSumaK] = useCampo("sumaK", "0");

  const metodo = NOMBRE_METODO[metodoNombre] ?? "darcy-weisbach";
  const material = MATERIALES_TUBERIA.find((m) => m.id === materialId) ?? MATERIALES_TUBERIA[0];

  const cambiarMaterial = (nombre: string) => {
    const m = MATERIALES_TUBERIA.find((x) => x.nombre === nombre);
    if (!m) return;
    setMaterialId(m.id);
    setRugosidadMm(textoDe(m.rugosidadMm));
    setHazenC(textoDe(m.hazenC));
  };

  const valores = {
    caudalLs: aNumero(caudalLsTexto),
    diametroMm: aNumero(diametroMmTexto),
    longitudM: aNumero(longitudMTexto),
    rugosidadMm: aNumero(rugosidadMmTexto),
    hazenC: aNumero(hazenCTexto),
    temperaturaC: aNumero(temperaturaCTexto),
    sumaK: aNumero(sumaKTexto),
  };

  const datosValidos =
    Number.isFinite(valores.caudalLs) &&
    valores.caudalLs > 0 &&
    Number.isFinite(valores.diametroMm) &&
    valores.diametroMm > 0 &&
    Number.isFinite(valores.longitudM) &&
    valores.longitudM > 0 &&
    Number.isFinite(valores.rugosidadMm) &&
    Number.isFinite(valores.hazenC) &&
    valores.hazenC > 0 &&
    Number.isFinite(valores.temperaturaC) &&
    Number.isFinite(valores.sumaK) &&
    valores.sumaK >= 0;

  const resultado = datosValidos ? calcularPerdidaCarga({ metodo, ...valores }) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones
          metodos={meta.metodosDisponibles}
          metodo={metodoNombre}
          onMetodoChange={setMetodoNombre}
        />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Tubería</p>
            <CampoSeleccion
              id="material"
              etiqueta="Material"
              valor={material.nombre}
              opciones={MATERIALES_TUBERIA.map((m) => m.nombre)}
              onChange={cambiarMaterial}
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico
                id="diametro"
                etiqueta="Diámetro interior"
                sufijo="mm"
                valor={diametroMmTexto}
                onChange={setDiametroMm}
              />
              <CampoNumerico
                id="longitud"
                etiqueta="Longitud del tramo"
                sufijo="m"
                valor={longitudMTexto}
                onChange={setLongitudM}
              />
            </div>
            {metodo === "darcy-weisbach" ? (
              <CampoNumerico
                id="rugosidad"
                etiqueta="Rugosidad absoluta ε"
                sufijo="mm"
                valor={rugosidadMmTexto}
                onChange={setRugosidadMm}
                advertencia="Se completa sola al elegir el material; se puede ajustar a mano."
              />
            ) : (
              <CampoNumerico
                id="hazenC"
                etiqueta="Coeficiente C de Hazen-Williams"
                valor={hazenCTexto}
                onChange={setHazenC}
                advertencia="Se completa solo al elegir el material; se puede ajustar a mano."
              />
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Caudal y fluido</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="caudal" etiqueta="Caudal Q" sufijo="L/s" valor={caudalLsTexto} onChange={setCaudalLs} />
              {metodo === "darcy-weisbach" && (
                <CampoNumerico
                  id="temperatura"
                  etiqueta="Temperatura del agua"
                  sufijo="°C"
                  valor={temperaturaCTexto}
                  onChange={setTemperaturaC}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Pérdidas localizadas</p>
            <CampoNumerico
              id="sumaK"
              etiqueta="Σ K de accesorios"
              valor={sumaKTexto}
              onChange={setSumaK}
              advertencia="Suma de los coeficientes K de codos, válvulas, entradas y salidas del tramo. Dejar en 0 si sólo interesa la fricción."
            />
          </div>
        </div>

        <div className="space-y-6">
          {!resultado ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              Completá los datos de la tubería y el caudal para calcular la pérdida de carga.
              Revisá que no haya ningún campo vacío o en cero donde no corresponde.
            </div>
          ) : (
            <>
              <DiagramaPerdidaCarga longitudM={valores.longitudM} perdidaTotalM={resultado.perdidaTotalM} />

              <PanelMetricas
                horizontal
                metricas={[
                  { etiqueta: "Velocidad", valor: `${fmt(resultado.velocidadMs, 3)} m/s` },
                  ...(resultado.reynolds !== null
                    ? [
                        {
                          etiqueta: "Reynolds",
                          valor: fmt(resultado.reynolds, 0),
                          nota: resultado.regimen ? NOMBRE_REGIMEN[resultado.regimen] : undefined,
                        },
                      ]
                    : []),
                  { etiqueta: "Pérdida total", valor: `${fmt(resultado.perdidaTotalM, 3)} m`, destacada: true },
                  { etiqueta: "Pérdida total", valor: `${fmt(resultado.perdidaTotalKPa, 2)} kPa` },
                ]}
              />

              <div className="space-y-1">
                <PanelFormulas
                  titulo="Ver cálculo"
                  filas={[
                    {
                      etiqueta: "V = Q/A",
                      formula: "Q/A",
                      sustitucion: `${fmt(resultado.caudalM3s, 4)} / ${fmt(resultado.areaM2, 4)}`,
                      valor: `${fmt(resultado.velocidadMs, 3)} m/s`,
                    },
                    ...(metodo === "darcy-weisbach" && resultado.reynolds !== null
                      ? [
                          {
                            etiqueta: "Re = V·D/ν",
                            formula: "V·D/ν",
                            sustitucion: `${fmt(resultado.velocidadMs, 3)} · ${fmt(valores.diametroMm / 1000, 3)} / (${fmt(
                              viscosidadCinematicaAgua(valores.temperaturaC) * 1e6,
                              3
                            )}×10⁻⁶)`,
                            valor: fmt(resultado.reynolds, 0),
                          },
                          {
                            etiqueta:
                              resultado.regimen === "laminar"
                                ? "f = 64/Re"
                                : "f — Colebrook-White: 1/√f = −2·log(ε/3,7D + 2,51/(Re√f))",
                            valor: fmt(resultado.factorFriccion ?? NaN, 4),
                          },
                          {
                            etiqueta: "hf = f·(L/D)·V²/2g",
                            formula: "f·(L/D)·V²/(2g)",
                            sustitucion: `${fmt(resultado.factorFriccion ?? NaN, 4)} · (${fmt(valores.longitudM, 1)}/${fmt(
                              valores.diametroMm / 1000,
                              3
                            )}) · ${fmt(resultado.velocidadMs, 3)}²/(2·9,81)`,
                            valor: `${fmt(resultado.perdidaFriccionM, 3)} m`,
                          },
                        ]
                      : [
                          {
                            etiqueta: "hf = 10,67·L·(Q/C)^1,852 / D^4,87",
                            formula: "10,67·L·(Q/C)^1,852/D^4,87",
                            sustitucion: `10,67 · ${fmt(valores.longitudM, 1)} · (${fmt(resultado.caudalM3s, 4)}/${fmt(
                              valores.hazenC,
                              0
                            )})^1,852 / ${fmt(valores.diametroMm / 1000, 3)}^4,87`,
                            valor: `${fmt(resultado.perdidaFriccionM, 3)} m`,
                          },
                        ]),
                    {
                      etiqueta: "hf,localizada = ΣK·V²/2g",
                      formula: "ΣK·V²/(2g)",
                      sustitucion: `${fmt(valores.sumaK, 2)} · ${fmt(resultado.velocidadMs, 3)}²/(2·9,81)`,
                      valor: `${fmt(resultado.perdidaLocalizadaM, 3)} m`,
                    },
                    {
                      etiqueta: "hf,total = hf + hf,localizada",
                      valor: `${fmt(resultado.perdidaTotalM, 3)} m`,
                    },
                    {
                      etiqueta: "Pendiente hidráulica J = hf/L",
                      valor: `${fmt(resultado.pendienteHidraulica * 1000, 3)} ‰`,
                    },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
