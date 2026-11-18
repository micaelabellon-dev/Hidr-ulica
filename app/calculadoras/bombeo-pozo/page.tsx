"use client";

import { useMemo } from "react";
import { useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { GraficoLineas, type SerieGrafico } from "@/components/calculadoras/graficos/GraficoLineas";
import {
  alturaSistema,
  calcularBombeo,
  COLUMNAS_CURVA_BOMBA,
  CURVA_BOMBA_EJEMPLO,
  densidadAgua,
  evaluarPolinomio,
  npshDisponible,
  presionAtmosfericaKPa,
  presionVaporKPa,
  validarCurvaBomba,
  type DatosBombeo,
  type PerdidasTramo,
  type ResultadoBombeo,
  type ResultadoNivel,
  type TipoBomba,
} from "@/lib/calc/hidraulica/bombeo";
import { G, type MetodoPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";
import { MATERIALES_TUBERIA } from "@/lib/calc/hidraulica/materiales";
import { numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("bombeo-pozo");

const NOMBRE_METODO: Record<string, MetodoPerdidaCarga> = {
  "Darcy-Weisbach": "darcy-weisbach",
  "Hazen-Williams": "hazen-williams",
};

const NOMBRE_TIPO: Record<string, TipoBomba> = {
  "Bomba de aspiración (fuera del pozo)": "aspiracion",
  "Bomba sumergible": "sumergible",
};
const ETIQUETA_TIPO: Record<TipoBomba, string> = {
  aspiracion: "Bomba de aspiración (fuera del pozo)",
  sumergible: "Bomba sumergible",
};

const COLUMNAS_TABLA_BOMBA = [
  { titulo: "Q", sufijo: "L/s" },
  { titulo: "H", sufijo: "m" },
  { titulo: "η", sufijo: "%" },
  { titulo: "NPSHr", sufijo: "m" },
];

function textoDe(n: number): string {
  return String(n).replace(".", ",");
}

function plantillaBomba(): TablaSalida[] {
  return [
    {
      hoja: "Curva de la bomba",
      encabezados: COLUMNAS_CURVA_BOMBA.map((c) => c.nombre),
      filas: CURVA_BOMBA_EJEMPLO.map((f) => f.map((x) => numeroDeCelda(x))),
      formatos: ["0.0", "0.00", "0.0", "0.00"],
    },
    {
      hoja: "Instrucciones",
      encabezados: ["columna", "contenido", "unidad"],
      filas: [
        ["caudal_ls", "Caudal del punto de catálogo", "L/s"],
        ["altura_m", "Altura manométrica de la bomba en ese caudal", "m"],
        ["rendimiento_pct", "Opcional: rendimiento de la bomba", "%"],
        ["npshr_m", "Opcional: NPSH requerido (sólo bombas de aspiración)", "m"],
      ],
    },
  ];
}

const NOMBRE_NIVEL = { minimo: "nivel mínimo", maximo: "nivel máximo" } as const;

export default function BombeoPozoPage() {
  const [metodoNombre, setMetodoNombre] = useCampo("metodo", "Darcy-Weisbach");
  const [tipoNombre, setTipoNombre] = useCampo("tipo", "Bomba sumergible");
  const [materialId, setMaterialId] = useCampo("material", "pvc");
  const [caudalTexto, setCaudal] = useCampo("caudal", "20");
  const [temperaturaTexto, setTemperatura] = useCampo("temperatura", "20");
  const [cotaMinTexto, setCotaMin] = useCampo("cotaMin", "62");
  const [cotaMaxTexto, setCotaMax] = useCampo("cotaMax", "74");
  const [cotaDescargaTexto, setCotaDescarga] = useCampo("cotaDescarga", "100");
  const [presionDescargaTexto, setPresionDescarga] = useCampo("presionDescarga", "0");
  const [longitudTexto, setLongitud] = useCampo("longitud", "150");
  const [diametroTexto, setDiametro] = useCampo("diametro", "125");
  const [rugosidadTexto, setRugosidad] = useCampo("rugosidad", "0,0015");
  const [hazenCTexto, setHazenC] = useCampo("hazenC", "150");
  const [sumaKTexto, setSumaK] = useCampo("sumaK", "6");
  // Bomba de aspiración
  const [cotaEjeTexto, setCotaEje] = useCampo("cotaEje", "65");
  const [longSuccionTexto, setLongSuccion] = useCampo("longSuccion", "20");
  const [diamSuccionTexto, setDiamSuccion] = useCampo("diamSuccion", "150");
  const [sumaKSuccionTexto, setSumaKSuccion] = useCampo("sumaKSuccion", "3");
  const [altitudTexto, setAltitud] = useCampo("altitud", "500");
  const [npshrManualTexto, setNpshrManual] = useCampo("npshrManual", "");
  const [margenTexto, setMargen] = useCampo("margen", "0,5");
  // Bomba sumergible
  const [cotaAdmisionTexto, setCotaAdmision] = useCampo("cotaAdmision", "55");
  const [sumergenciaTexto, setSumergencia] = useCampo("sumergencia", "3");
  // Curva
  const [filasBomba, setFilasBomba] = useTabla("curvaBomba", CURVA_BOMBA_EJEMPLO);
  const [gradoNombre, setGradoNombre] = useCampo("grado", "Grado 2 (parábola)");
  const [nivelDetalle, setNivelDetalle] = useCampo("nivelDetalle", "Nivel mínimo");

  const metodo = NOMBRE_METODO[metodoNombre] ?? "darcy-weisbach";
  const tipo = NOMBRE_TIPO[tipoNombre] ?? "sumergible";
  const grado: 2 | 3 = gradoNombre.startsWith("Grado 3") ? 3 : 2;
  const material = MATERIALES_TUBERIA.find((m) => m.id === materialId) ?? MATERIALES_TUBERIA[0];

  const cambiarMaterial = (nombre: string) => {
    const m = MATERIALES_TUBERIA.find((x) => x.nombre === nombre);
    if (!m) return;
    setMaterialId(m.id);
    setRugosidad(textoDe(m.rugosidadMm));
    setHazenC(textoDe(m.hazenC));
  };

  const v = {
    caudal: aNumero(caudalTexto),
    temperatura: aNumero(temperaturaTexto),
    cotaMin: aNumero(cotaMinTexto),
    cotaMax: aNumero(cotaMaxTexto),
    cotaDescarga: aNumero(cotaDescargaTexto),
    presionDescarga: aNumero(presionDescargaTexto),
    longitud: aNumero(longitudTexto),
    diametro: aNumero(diametroTexto),
    rugosidad: aNumero(rugosidadTexto),
    hazenC: aNumero(hazenCTexto),
    sumaK: aNumero(sumaKTexto),
    cotaEje: aNumero(cotaEjeTexto),
    longSuccion: aNumero(longSuccionTexto),
    diamSuccion: aNumero(diamSuccionTexto),
    sumaKSuccion: aNumero(sumaKSuccionTexto),
    altitud: aNumero(altitudTexto),
    margen: aNumero(margenTexto),
    cotaAdmision: aNumero(cotaAdmisionTexto),
    sumergencia: aNumero(sumergenciaTexto),
  };
  const npshrManual = npshrManualTexto.trim() === "" ? null : aNumero(npshrManualTexto);

  const validacionCurva = useMemo(() => validarCurvaBomba(filasBomba, grado), [filasBomba, grado]);

  const errores: string[] = [];
  const positivo = (x: number, nombre: string) => {
    if (!Number.isFinite(x) || x <= 0) errores.push(`${nombre} tiene que ser un número mayor que cero.`);
  };
  const finito = (x: number, nombre: string) => {
    if (!Number.isFinite(x)) errores.push(`${nombre} no es un número.`);
  };
  positivo(v.caudal, "El caudal de diseño");
  finito(v.temperatura, "La temperatura");
  finito(v.cotaMin, "La cota del nivel mínimo");
  finito(v.cotaMax, "La cota del nivel máximo");
  finito(v.cotaDescarga, "La cota de descarga");
  finito(v.presionDescarga, "La presión en la descarga");
  positivo(v.longitud, "La longitud de la impulsión");
  positivo(v.diametro, "El diámetro de la impulsión");
  if (metodo === "darcy-weisbach") finito(v.rugosidad, "La rugosidad");
  else positivo(v.hazenC, "El coeficiente C");
  if (!(v.sumaK >= 0)) errores.push("La Σ K de la impulsión tiene que ser ≥ 0.");
  if (Number.isFinite(v.cotaMin) && Number.isFinite(v.cotaMax) && v.cotaMin > v.cotaMax) {
    errores.push("El nivel mínimo no puede estar por encima del máximo.");
  }
  if (tipo === "aspiracion") {
    finito(v.cotaEje, "La cota del eje de la bomba");
    positivo(v.longSuccion, "La longitud de la succión");
    positivo(v.diamSuccion, "El diámetro de la succión");
    if (!(v.sumaKSuccion >= 0)) errores.push("La Σ K de la succión tiene que ser ≥ 0.");
    finito(v.altitud, "La altitud");
    if (!(v.margen >= 0)) errores.push("El margen de NPSH tiene que ser ≥ 0.");
    if (npshrManual !== null && !(npshrManual >= 0)) errores.push("El NPSHr fijo tiene que ser un número ≥ 0.");
  } else {
    finito(v.cotaAdmision, "La cota de la admisión");
    if (!(v.sumergencia >= 0)) errores.push("La sumergencia mínima tiene que ser ≥ 0.");
  }

  const datos: DatosBombeo | null =
    errores.length === 0 && validacionCurva.puntos
      ? {
          tipo,
          metodo,
          temperaturaC: v.temperatura,
          caudalDisenoLs: v.caudal,
          cotaNivelMinimoM: v.cotaMin,
          cotaNivelMaximoM: v.cotaMax,
          cotaDescargaM: v.cotaDescarga,
          presionDescargaM: v.presionDescarga,
          impulsion: {
            longitudM: v.longitud,
            diametroMm: v.diametro,
            rugosidadMm: v.rugosidad,
            hazenC: v.hazenC,
            sumaK: v.sumaK,
          },
          succion:
            tipo === "aspiracion"
              ? {
                  longitudM: v.longSuccion,
                  diametroMm: v.diamSuccion,
                  rugosidadMm: v.rugosidad,
                  hazenC: v.hazenC,
                  sumaK: v.sumaKSuccion,
                }
              : null,
          cotaEjeBombaM: v.cotaEje,
          altitudMsnm: v.altitud,
          npshrManualM: npshrManual,
          margenNpshM: v.margen,
          cotaAdmisionM: v.cotaAdmision,
          sumergenciaMinimaM: v.sumergencia,
          curvaBomba: validacionCurva.puntos,
          gradoAjuste: grado,
        }
      : null;

  const resultado = datos ? calcularBombeo(datos) : null;
  const nivelSel = nivelDetalle === "Nivel máximo" ? "maximo" : "minimo";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="spec-label">{meta.categoria} · Calculadoras</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nombre}</h1>
        </div>
        <BarraAcciones metodos={meta.metodosDisponibles} metodo={metodoNombre} onMetodoChange={setMetodoNombre} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="spec-label">Pozo y bomba</p>
            <CampoSeleccion
              id="tipo"
              etiqueta="Tipo de instalación"
              valor={ETIQUETA_TIPO[tipo]}
              opciones={Object.keys(NOMBRE_TIPO)}
              onChange={setTipoNombre}
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="cotaMin" etiqueta="Cota nivel mínimo" sufijo="m" valor={cotaMinTexto} onChange={setCotaMin} />
              <CampoNumerico id="cotaMax" etiqueta="Cota nivel máximo" sufijo="m" valor={cotaMaxTexto} onChange={setCotaMax} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Niveles del agua en el pozo. El mínimo es el dinámico: incluye el descenso por bombeo.
            </p>
            {tipo === "aspiracion" ? (
              <CampoNumerico
                id="cotaEje"
                etiqueta="Cota del eje de la bomba"
                sufijo="m"
                valor={cotaEjeTexto}
                onChange={setCotaEje}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico
                  id="cotaAdmision"
                  etiqueta="Cota de la admisión"
                  sufijo="m"
                  valor={cotaAdmisionTexto}
                  onChange={setCotaAdmision}
                />
                <CampoNumerico
                  id="sumergencia"
                  etiqueta="Sumergencia mínima"
                  sufijo="m"
                  valor={sumergenciaTexto}
                  onChange={setSumergencia}
                />
              </div>
            )}
            {tipo === "sumergible" && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Sumergencia mínima del fabricante sobre la admisión (rejilla de entrada), para evitar vórtices y
                asegurar la refrigeración del motor.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Caudal y descarga</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="caudal" etiqueta="Caudal de diseño" sufijo="L/s" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico
                id="temperatura"
                etiqueta="Temperatura del agua"
                sufijo="°C"
                valor={temperaturaTexto}
                onChange={setTemperatura}
              />
              <CampoNumerico
                id="cotaDescarga"
                etiqueta="Cota de descarga"
                sufijo="m"
                valor={cotaDescargaTexto}
                onChange={setCotaDescarga}
              />
              <CampoNumerico
                id="presionDescarga"
                etiqueta="Presión en la descarga"
                sufijo="m.c.a."
                valor={presionDescargaTexto}
                onChange={setPresionDescarga}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Presión en la descarga: 0 si descarga libre a un tanque; si no, la presión que hay que dejar disponible.
            </p>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Impulsión</p>
            <CampoSeleccion
              id="material"
              etiqueta="Material"
              valor={material.nombre}
              opciones={MATERIALES_TUBERIA.map((m) => m.nombre)}
              onChange={cambiarMaterial}
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="diametro" etiqueta="Diámetro interior" sufijo="mm" valor={diametroTexto} onChange={setDiametro} />
              <CampoNumerico id="longitud" etiqueta="Longitud" sufijo="m" valor={longitudTexto} onChange={setLongitud} />
              {metodo === "darcy-weisbach" ? (
                <CampoNumerico id="rugosidad" etiqueta="Rugosidad ε" sufijo="mm" valor={rugosidadTexto} onChange={setRugosidad} />
              ) : (
                <CampoNumerico id="hazenC" etiqueta="Coeficiente C" valor={hazenCTexto} onChange={setHazenC} />
              )}
              <CampoNumerico id="sumaK" etiqueta="Σ K de accesorios" valor={sumaKTexto} onChange={setSumaK} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              {tipo === "sumergible" ? "Con bomba sumergible, la longitud incluye la columna dentro del pozo. " : ""}Σ K:
              válvula de retención, esclusa, codos y salida (K = 1).
            </p>
          </div>

          {tipo === "aspiracion" && (
            <div className="space-y-4">
              <p className="spec-label">Succión y NPSH</p>
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico
                  id="diamSuccion"
                  etiqueta="Diámetro de succión"
                  sufijo="mm"
                  valor={diamSuccionTexto}
                  onChange={setDiamSuccion}
                />
                <CampoNumerico
                  id="longSuccion"
                  etiqueta="Longitud de succión"
                  sufijo="m"
                  valor={longSuccionTexto}
                  onChange={setLongSuccion}
                />
                <CampoNumerico
                  id="sumaKSuccion"
                  etiqueta="Σ K de la succión"
                  valor={sumaKSuccionTexto}
                  onChange={setSumaKSuccion}
                />
                <CampoNumerico id="altitud" etiqueta="Altitud del sitio" sufijo="m s.n.m." valor={altitudTexto} onChange={setAltitud} />
                <CampoNumerico id="margen" etiqueta="Margen NPSHd − NPSHr" sufijo="m" valor={margenTexto} onChange={setMargen} />
                <CampoNumerico
                  id="npshrManual"
                  etiqueta="NPSHr fijo (opcional)"
                  sufijo="m"
                  valor={npshrManualTexto}
                  onChange={setNpshrManual}
                />
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Misma tubería que la impulsión. Σ K de la succión: válvula de pie con colador, codos y reducción
                excéntrica. El NPSHr fijo se usa sólo si la curva no trae la columna NPSHr.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="spec-label">Curva de la bomba</p>
            <BarraArchivos
              id="curva-bomba"
              especs={COLUMNAS_CURVA_BOMBA}
              onImportar={setFilasBomba}
              plantilla={plantillaBomba}
              nombrePlantilla="plantilla-curva-bomba"
            />
            <TablaEditable
              id="tabla-bomba"
              columnas={COLUMNAS_TABLA_BOMBA}
              filas={filasBomba}
              onChange={setFilasBomba}
              filasConError={filasDeErrores(validacionCurva.errores)}
            />
            <p className="text-xs text-muted-foreground">
              Puntos de catálogo Q-H; η y NPSHr son opcionales (dejar vacío).
            </p>
            <CampoSeleccion
              id="grado"
              etiqueta="Ajuste polinómico"
              valor={grado === 3 ? "Grado 3 (cúbica)" : "Grado 2 (parábola)"}
              opciones={["Grado 2 (parábola)", "Grado 3 (cúbica)"]}
              onChange={setGradoNombre}
            />
            <ListaErrores titulo="Errores en la curva de la bomba" errores={validacionCurva.errores} />
          </div>
        </div>

        <div className="space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {!resultado || !datos ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              Completá los datos del pozo, la impulsión y la curva de la bomba para calcular el punto de operación.
            </div>
          ) : (
            <Resultados datos={datos} resultado={resultado} nivelSel={nivelSel} nivelDetalle={nivelDetalle} setNivelDetalle={setNivelDetalle} />
          )}
        </div>
      </div>
    </main>
  );
}

function Resultados({
  datos,
  resultado,
  nivelSel,
  nivelDetalle,
  setNivelDetalle,
}: {
  datos: DatosBombeo;
  resultado: ResultadoBombeo;
  nivelSel: "minimo" | "maximo";
  nivelDetalle: string;
  setNivelDetalle: (v: string) => void;
}) {
  const { minimo, maximo } = resultado.niveles;
  const qTope = Math.max(resultado.caudalMaxCurvaLs, datos.caudalDisenoLs * 1.3);
  const muestras = 80;
  const qs = Array.from({ length: muestras + 1 }, (_, i) => (qTope * i) / muestras);
  const qsBomba = Array.from(
    { length: muestras + 1 },
    (_, i) => resultado.caudalMinCurvaLs + ((resultado.caudalMaxCurvaLs - resultado.caudalMinCurvaLs) * i) / muestras
  );

  const seriesH: SerieGrafico[] = [
    {
      id: "bomba",
      nombre: "Bomba (ajuste)",
      color: "var(--serie-1)",
      puntos: qsBomba.map((q) => ({ x: q, y: evaluarPolinomio(resultado.ajusteH.coef, q) })),
    },
    {
      id: "sistema-min",
      nombre: "Sistema, nivel mínimo",
      color: "var(--serie-2)",
      puntos: qs.map((q) => ({ x: q, y: alturaSistema(datos, datos.cotaNivelMinimoM, q) })),
    },
    {
      id: "sistema-max",
      nombre: "Sistema, nivel máximo",
      color: "var(--serie-3)",
      discontinua: true,
      puntos: qs.map((q) => ({ x: q, y: alturaSistema(datos, datos.cotaNivelMaximoM, q) })),
    },
    {
      id: "catalogo",
      nombre: "Puntos de catálogo",
      color: "var(--serie-1)",
      soloMarcadores: true,
      sinTooltip: true,
      puntos: datos.curvaBomba.map((p) => ({ x: p.caudalLs, y: p.alturaM })).sort((a, b) => a.x - b.x),
    },
  ];

  const destacados = [
    ...(minimo.operacion
      ? [{ x: minimo.operacion.caudalLs, y: minimo.operacion.alturaM, etiqueta: "A · nivel mín.", color: "var(--serie-2)" }]
      : []),
    ...(maximo.operacion
      ? [{ x: maximo.operacion.caudalLs, y: maximo.operacion.alturaM, etiqueta: "B · nivel máx.", color: "var(--serie-3)" }]
      : []),
  ];

  const banda = {
    desde: resultado.rangoRecomendadoLs[0],
    hasta: resultado.rangoRecomendadoLs[1],
    etiqueta: resultado.rangoSegun === "bep" ? "rango recomendado (70–120 % Q_BEP)" : "rango de la curva cargada",
  };

  const fmtQ = (q: number) => fmt(q, q < 10 ? 1 : 0);

  const seriesNpsh: SerieGrafico[] | null =
    datos.tipo === "aspiracion"
      ? [
          {
            id: "npshd-min",
            nombre: "NPSHd, nivel mínimo",
            color: "var(--serie-2)",
            puntos: qs.map((q) => ({ x: q, y: npshDisponible(datos, datos.cotaNivelMinimoM, q).npshdM })),
          },
          {
            id: "npshd-max",
            nombre: "NPSHd, nivel máximo",
            color: "var(--serie-3)",
            discontinua: true,
            puntos: qs.map((q) => ({ x: q, y: npshDisponible(datos, datos.cotaNivelMaximoM, q).npshdM })),
          },
          ...(resultado.ajusteNpshr
            ? [
                {
                  id: "npshr",
                  nombre: "NPSHr de la bomba",
                  color: "var(--serie-1)",
                  puntos: qsBomba.map((q) => ({ x: q, y: Math.max(0, evaluarPolinomio(resultado.ajusteNpshr!.coef, q)) })),
                },
              ]
            : datos.npshrManualM !== null
              ? [
                  {
                    id: "npshr",
                    nombre: "NPSHr fijo",
                    color: "var(--serie-1)",
                    puntos: [
                      { x: 0, y: datos.npshrManualM },
                      { x: qTope, y: datos.npshrManualM },
                    ],
                  },
                ]
              : []),
        ]
      : null;

  const niveles = [minimo, maximo];

  return (
    <>
      <PanelMetricas
        horizontal
        metricas={[
          {
            etiqueta: "H total, nivel mín.",
            valor: `${fmt(minimo.diseno.alturaTotalM, 2)} m`,
            nota: `con Q = ${fmt(datos.caudalDisenoLs, 1)} L/s`,
          },
          {
            etiqueta: "H total, nivel máx.",
            valor: `${fmt(maximo.diseno.alturaTotalM, 2)} m`,
            nota: `con Q = ${fmt(datos.caudalDisenoLs, 1)} L/s`,
          },
          {
            etiqueta: "Q operación (A–B)",
            valor: minimo.operacion && maximo.operacion
              ? `${fmt(minimo.operacion.caudalLs, 1)}–${fmt(maximo.operacion.caudalLs, 1)}`
              : "—",
            nota: "L/s, entre nivel mín. y máx.",
            destacada: true,
          },
          {
            etiqueta: "Potencia al eje máx.",
            valor: (() => {
              const p = niveles.map((n) => n.operacion?.potenciaEjeKw ?? NaN).filter(Number.isFinite);
              return p.length ? `${fmt(Math.max(...p), 1)} kW` : "—";
            })(),
            nota: resultado.ajusteRendimiento ? undefined : "Hace falta la curva de rendimiento",
          },
        ]}
      />

      <ListaAvisos avisos={resultado.avisos} />
      {niveles
        .filter((n) => n.motivoSinOperacion)
        .map((n) => (
          <ListaErrores key={n.nivel} titulo={`Sin punto de operación con ${NOMBRE_NIVEL[n.nivel]}`} errores={[n.motivoSinOperacion!]} />
        ))}

      <GraficoLineas
        titulo="Curvas de la bomba y del sistema"
        series={seriesH}
        destacados={destacados}
        bandaX={banda}
        formatoX={(q) => `${fmtQ(q)}`}
        formatoY={(h) => fmt(h, 0)}
        formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
        formatoValor={(h) => `${fmt(h, 2)} m`}
        ejeX="Caudal Q (L/s)"
        ejeY="Altura H (m)"
        desdeCero
        alto={300}
      />

      {resultado.ajusteRendimiento && (
        <GraficoLineas
          titulo="Rendimiento de la bomba"
          series={[
            {
              id: "eta",
              nombre: "η",
              color: "var(--serie-1)",
              puntos: qsBomba.map((q) => ({ x: q, y: Math.max(0, evaluarPolinomio(resultado.ajusteRendimiento!.coef, q)) })),
            },
          ]}
          destacados={niveles
            .filter((n) => n.operacion?.rendimientoPct != null)
            .map((n) => ({
              x: n.operacion!.caudalLs,
              y: n.operacion!.rendimientoPct!,
              etiqueta: n.nivel === "minimo" ? "A" : "B",
              color: n.nivel === "minimo" ? "var(--serie-2)" : "var(--serie-3)",
            }))}
          bandaX={banda}
          formatoX={fmtQ}
          formatoY={(e) => `${fmt(e, 0)} %`}
          formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
          formatoValor={(e) => `${fmt(e, 1)} %`}
          ejeX="Caudal Q (L/s)"
          ejeY="Rendimiento η (%)"
          desdeCero
          alto={200}
        />
      )}

      {seriesNpsh && seriesNpsh.length > 0 && (
        <GraficoLineas
          titulo="NPSH disponible y requerido"
          series={seriesNpsh}
          formatoX={fmtQ}
          formatoY={(h) => fmt(h, 1)}
          formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
          formatoValor={(h) => `${fmt(h, 2)} m`}
          ejeX="Caudal Q (L/s)"
          ejeY="NPSH (m)"
          alto={200}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Resultados por nivel del pozo</caption>
          <thead className="bg-muted/40 text-[11px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium" />
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Nivel mínimo</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Nivel máximo</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] tabular-nums">
            {(
              [
                ["Cota del agua", (n: ResultadoNivel) => `${fmt(n.cotaAguaM, 2)} m`],
                ["Altura estática", (n: ResultadoNivel) => `${fmt(n.alturaEstaticaM, 2)} m`],
                ["Pérdidas con Q diseño", (n: ResultadoNivel) => `${fmt(n.diseno.impulsion.totalM + (n.diseno.succion?.totalM ?? 0), 2)} m`],
                ["H total con Q diseño", (n: ResultadoNivel) => `${fmt(n.diseno.alturaTotalM, 2)} m`],
                ["Q de operación", (n: ResultadoNivel) => (n.operacion ? `${fmt(n.operacion.caudalLs, 2)} L/s` : "—")],
                ["H de operación", (n: ResultadoNivel) => (n.operacion ? `${fmt(n.operacion.alturaM, 2)} m` : "—")],
                ["Rendimiento η", (n: ResultadoNivel) => (n.operacion?.rendimientoPct != null ? `${fmt(n.operacion.rendimientoPct, 1)} %` : "—")],
                ["Potencia hidráulica", (n: ResultadoNivel) => (n.operacion ? `${fmt(n.operacion.potenciaHidraulicaKw, 2)} kW` : "—")],
                ["Potencia al eje", (n: ResultadoNivel) => (n.operacion?.potenciaEjeKw != null ? `${fmt(n.operacion.potenciaEjeKw, 2)} kW` : "—")],
                [
                  "Dentro del rango recomendado",
                  (n: ResultadoNivel) => (n.operacion ? (n.operacion.enRango ? "Sí" : "No") : "—"),
                ],
                ...(datos.tipo === "aspiracion"
                  ? ([
                      ["NPSH disponible", (n: ResultadoNivel) => `${fmt(n.npsh!.npshdM, 2)} m`],
                      ["NPSH requerido", (n: ResultadoNivel) => (n.npsh!.npshrM !== null ? `${fmt(n.npsh!.npshrM, 2)} m` : "—")],
                      [
                        `Verifica NPSHd ≥ NPSHr + ${fmt(datos.margenNpshM, 1)} m`,
                        (n: ResultadoNivel) => (n.npsh!.cumple === null ? "—" : n.npsh!.cumple ? "Sí" : "No"),
                      ],
                    ] as const)
                  : ([
                      ["Sumergencia disponible", (n: ResultadoNivel) => `${fmt(n.sumergencia!.disponibleM, 2)} m`],
                      [
                        `Verifica S ≥ ${fmt(datos.sumergenciaMinimaM, 2)} m`,
                        (n: ResultadoNivel) => (n.sumergencia!.cumple ? "Sí" : "No"),
                      ],
                    ] as const)),
              ] as const
            ).map(([etiqueta, f]) => (
              <tr key={etiqueta} className="border-t border-border/40">
                <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                  {etiqueta}
                </th>
                {niveles.map((n) => {
                  const valor = f(n);
                  return (
                    <td key={n.nivel} className={`px-2.5 py-1 text-right ${valor === "No" ? "font-semibold text-destructive" : ""}`}>
                      {valor}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-3 text-[11px] text-muted-foreground">
        {resultado.rangoSegun === "bep"
          ? `Máximo rendimiento ${fmt(resultado.rendimientoBepPct ?? NaN, 1)} % en Q_BEP = ${fmt(resultado.caudalBepLs ?? NaN, 1)} L/s; rango recomendado ${fmt(resultado.rangoRecomendadoLs[0], 1)} a ${fmt(resultado.rangoRecomendadoLs[1], 1)} L/s.`
          : `Sin curva de rendimiento, el rango recomendado se toma como el de la curva cargada (${fmt(resultado.rangoRecomendadoLs[0], 1)} a ${fmt(resultado.rangoRecomendadoLs[1], 1)} L/s).`}{" "}
        {datos.tipo === "aspiracion" ? "NPSH y sumergencia evaluados en el caudal de operación." : ""}
      </p>

      <div className="space-y-2">
        <div className="w-48 print:hidden">
          <CampoSeleccion
            id="nivelDetalle"
            etiqueta="Detallar el cálculo con"
            valor={nivelDetalle === "Nivel máximo" ? "Nivel máximo" : "Nivel mínimo"}
            opciones={["Nivel mínimo", "Nivel máximo"]}
            onChange={setNivelDetalle}
          />
        </div>
        <PanelFormulas
          titulo={`Ver cálculo · ${NOMBRE_NIVEL[nivelSel]}`}
          filas={filasDetalle(datos, resultado, resultado.niveles[nivelSel])}
        />
      </div>
    </>
  );
}

function filasTramo(nombre: string, sub: string, t: PerdidasTramo, tramo: DatosBombeo["impulsion"], datos: DatosBombeo) {
  const D = tramo.diametroMm / 1000;
  const Q = datos.caudalDisenoLs / 1000;
  const filas = [
    {
      etiqueta: `V_${sub} = Q/A`,
      formula: "Q / (π·D²/4)",
      sustitucion: `${fmt(Q, 4)} / (π·${fmt(D, 3)}²/4)`,
      valor: `${fmt(t.velocidadMs, 3)} m/s`,
    },
    datos.metodo === "darcy-weisbach"
      ? {
          etiqueta: `hf_${sub} (${nombre})`,
          formula: "f·(L/D)·V²/(2g)",
          sustitucion: `${fmt(t.factorFriccion ?? NaN, 4)} · (${fmt(tramo.longitudM, 1)}/${fmt(D, 3)}) · ${fmt(t.velocidadMs, 3)}²/(2·9,81)`,
          valor: `${fmt(t.friccionM, 3)} m`,
        }
      : {
          etiqueta: `hf_${sub} (${nombre})`,
          formula: "10,67·L·(Q/C)^1,852 / D^4,87",
          sustitucion: `10,67 · ${fmt(tramo.longitudM, 1)} · (${fmt(Q, 4)}/${fmt(tramo.hazenC, 0)})^1,852 / ${fmt(D, 3)}^4,87`,
          valor: `${fmt(t.friccionM, 3)} m`,
        },
    {
      etiqueta: `hl_${sub} (accesorios)`,
      formula: "ΣK·V²/(2g)",
      sustitucion: `${fmt(tramo.sumaK, 2)} · ${fmt(t.velocidadMs, 3)}²/(2·9,81)`,
      valor: `${fmt(t.localizadaM, 3)} m`,
    },
  ];
  if (datos.metodo === "darcy-weisbach" && t.reynolds !== null) {
    filas.splice(1, 0, {
      etiqueta: `Re_${sub}, f`,
      formula: "V·D/ν ; Colebrook-White",
      sustitucion: `Re = ${fmt(t.reynolds, 0)}`,
      valor: `f = ${fmt(t.factorFriccion ?? NaN, 4)}`,
    });
  }
  return filas;
}

function filasDetalle(datos: DatosBombeo, resultado: ResultadoBombeo, n: ResultadoNivel) {
  const filas: { etiqueta: string; formula?: string; sustitucion?: string; valor: string }[] = [];
  filas.push({
    etiqueta: "H_est",
    formula: "z_descarga − z_agua + p_descarga/γ",
    sustitucion: `${fmt(datos.cotaDescargaM, 2)} − ${fmt(n.cotaAguaM, 2)} + ${fmt(datos.presionDescargaM, 2)}`,
    valor: `${fmt(n.alturaEstaticaM, 3)} m`,
  });
  filas.push(...filasTramo("fricción", "imp", n.diseno.impulsion, datos.impulsion, datos));
  if (n.diseno.succion && datos.succion) filas.push(...filasTramo("fricción", "suc", n.diseno.succion, datos.succion, datos));
  const hfImp = n.diseno.impulsion.totalM;
  const hfSuc = n.diseno.succion?.totalM ?? 0;
  filas.push({
    etiqueta: "H_total (Q diseño)",
    formula: datos.tipo === "aspiracion" ? "H_est + (hf + hl)_imp + (hf + hl)_suc" : "H_est + (hf + hl)_imp",
    sustitucion:
      datos.tipo === "aspiracion"
        ? `${fmt(n.alturaEstaticaM, 3)} + ${fmt(hfImp, 3)} + ${fmt(hfSuc, 3)}`
        : `${fmt(n.alturaEstaticaM, 3)} + ${fmt(hfImp, 3)}`,
    valor: `${fmt(n.diseno.alturaTotalM, 3)} m`,
  });

  const c = resultado.ajusteH.coef;
  const terminos = c
    .map((a, i) => (i === 0 ? fmt(a, 3) : `${a < 0 ? "−" : "+"} ${fmt(Math.abs(a), i === 1 ? 4 : 6)}·Q${i === 1 ? "" : i === 2 ? "²" : "³"}`))
    .join(" ");
  filas.push({
    etiqueta: "Curva de la bomba",
    formula: c.length === 3 ? "a₀ + a₁·Q + a₂·Q²" : "a₀ + a₁·Q + a₂·Q² + a₃·Q³",
    sustitucion: `H(Q) = ${terminos}`,
    valor: `R² = ${fmt(resultado.ajusteH.r2, 4)}`,
  });
  if (n.operacion) {
    const op = n.operacion;
    filas.push({
      etiqueta: "Punto de operación",
      formula: "H_bomba(Q) = H_sistema(Q), por bisección",
      sustitucion: `H_bomba(${fmt(op.caudalLs, 2)}) = ${fmt(op.alturaM, 3)} ≈ H_sist(${fmt(op.caudalLs, 2)}) = ${fmt(alturaSistema(datos, n.cotaAguaM, op.caudalLs), 3)}`,
      valor: `Q = ${fmt(op.caudalLs, 2)} L/s, H = ${fmt(op.alturaM, 2)} m`,
    });
    const rho = densidadAgua(datos.temperaturaC);
    filas.push({
      etiqueta: "P_hidráulica",
      formula: "ρ·g·Q·H",
      sustitucion: `${fmt(rho, 1)} · 9,81 · ${fmt(op.caudalLs / 1000, 4)} · ${fmt(op.alturaM, 2)} / 1000`,
      valor: `${fmt(op.potenciaHidraulicaKw, 3)} kW`,
    });
    if (op.potenciaEjeKw !== null && op.rendimientoPct !== null) {
      filas.push({
        etiqueta: "P_eje",
        formula: "P_hidráulica / η",
        sustitucion: `${fmt(op.potenciaHidraulicaKw, 3)} / ${fmt(op.rendimientoPct / 100, 3)}`,
        valor: `${fmt(op.potenciaEjeKw, 3)} kW`,
      });
    }
  }

  if (n.npsh) {
    const g = (densidadAgua(datos.temperaturaC) * G) / 1000;
    const q = n.operacion?.caudalLs ?? datos.caudalDisenoLs;
    filas.push(
      {
        etiqueta: "p_atm/γ",
        formula: "101,325·(1 − 2,25577×10⁻⁵·z)^5,25588 / γ",
        sustitucion: `${fmt(presionAtmosfericaKPa(datos.altitudMsnm), 2)} kPa / ${fmt(g, 3)} kN/m³`,
        valor: `${fmt(n.npsh.patmM, 3)} m`,
      },
      {
        etiqueta: "p_v/γ",
        formula: `p_v(${fmt(datos.temperaturaC, 0)} °C) / γ`,
        sustitucion: `${fmt(presionVaporKPa(datos.temperaturaC), 3)} kPa / ${fmt(g, 3)} kN/m³`,
        valor: `${fmt(n.npsh.pvM, 3)} m`,
      },
      {
        etiqueta: "h_s (aspiración)",
        formula: "z_eje − z_agua",
        sustitucion: `${fmt(datos.cotaEjeBombaM, 2)} − ${fmt(n.cotaAguaM, 2)}`,
        valor: `${fmt(n.npsh.alturaAspiracionM, 3)} m`,
      },
      {
        etiqueta: `NPSHd (Q = ${fmt(q, 2)} L/s)`,
        formula: "p_atm/γ − p_v/γ − h_s − hf_suc",
        sustitucion: `${fmt(n.npsh.patmM, 3)} − ${fmt(n.npsh.pvM, 3)} − ${fmt(n.npsh.alturaAspiracionM, 3)} − ${fmt(n.npsh.hfSuccionM, 3)}`,
        valor: `${fmt(n.npsh.npshdM, 3)} m`,
      },
      {
        etiqueta: "Verificación NPSH",
        formula: "NPSHd ≥ NPSHr + margen",
        sustitucion:
          n.npsh.npshrM === null
            ? "sin NPSHr"
            : `${fmt(n.npsh.npshdM, 2)} ≥ ${fmt(n.npsh.npshrM, 2)} + ${fmt(datos.margenNpshM, 2)}`,
        valor: n.npsh.cumple === null ? "sin verificar" : n.npsh.cumple ? "verifica" : "NO verifica",
      }
    );
  }
  if (n.sumergencia) {
    filas.push({
      etiqueta: "Sumergencia S",
      formula: "z_agua − z_admisión ≥ S_mín",
      sustitucion: `${fmt(n.cotaAguaM, 2)} − ${fmt(datos.cotaAdmisionM, 2)} = ${fmt(n.sumergencia.disponibleM, 2)} ≥ ${fmt(n.sumergencia.requeridaM, 2)}`,
      valor: n.sumergencia.cumple ? "verifica" : "NO verifica",
    });
  }
  return filas;
}
