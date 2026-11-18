"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { escribirCampos, useCampo, useTabla } from "@/lib/hooks/useCampo";
import { BarraAcciones } from "@/components/calculadoras/comun/BarraAcciones";
import { BarraArchivos, botonArchivo, ListaAvisos, ListaErrores } from "@/components/calculadoras/comun/BarraArchivos";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { PanelFormulas } from "@/components/calculadoras/comun/PanelFormulas";
import { PanelMetricas } from "@/components/calculadoras/comun/PanelMetricas";
import { filasDeErrores, TablaEditable } from "@/components/calculadoras/comun/TablaEditable";
import { DiagramaBombeo } from "@/components/calculadoras/croquis/DiagramaBombeo";
import { GraficoLineas, type SerieGrafico } from "@/components/calculadoras/graficos/GraficoLineas";
import { diametroInteriorMm, EditorTramo, sumaKTramo, type TramoUI } from "@/components/calculadoras/bombeo/EditorTramo";
import {
  ACCESORIOS,
  alturaSistema,
  calcularBombeo,
  COLUMNAS_CURVA_BOMBA,
  evaluarPolinomio,
  npshDisponible,
  perdidasSistema,
  presionAtmosfericaKPa,
  presionVaporKPa,
  validarCurvaBomba,
  type DatosBombeo,
  type PerdidasTramo,
  type ResultadoBombeo,
  type TipoBomba,
  type TramoTuberia,
} from "@/lib/calc/hidraulica/bombeo";
import type { MetodoPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";
import { numeroDeCelda, type TablaSalida } from "@/lib/calculadoras/tablas";
import { aNumero, fmt } from "@/lib/calculadoras/formato";
import { buscarCalculadora } from "@/lib/calculadoras/registry";

const meta = buscarCalculadora("bombeo-pozo");
const metaGolpe = buscarCalculadora("golpe-ariete");

const NOMBRE_METODO: Record<string, MetodoPerdidaCarga> = {
  "Darcy-Weisbach": "darcy-weisbach",
  "Hazen-Williams": "hazen-williams",
};

const NOMBRE_TIPO: Record<string, TipoBomba> = {
  "Bomba sumergible": "sumergible",
  "Bomba de aspiración (fuera del pozo)": "aspiracion",
};
const ETIQUETA_TIPO: Record<TipoBomba, string> = {
  aspiracion: "Bomba de aspiración (fuera del pozo)",
  sumergible: "Bomba sumergible",
};

const VARIANTES_HW = {
  "10,67 · (Q/C)^1,852 (SI)": { coef: 10.67, exp: 1.852 },
  "10,643 · (Q/C)^1,85": { coef: 10.643, exp: 1.85 },
} as const;

const COLUMNAS_TABLA_BOMBA = [
  { titulo: "Q", sufijo: "L/s" },
  { titulo: "H", sufijo: "m" },
  { titulo: "η", sufijo: "%" },
  { titulo: "NPSHr", sufijo: "m" },
];

/**
 * Ejemplo: estación de bombeo de 12,5 L/s, 1 + 1 bombas sumergibles, colector
 * de cada bomba en PEAD DN110 e impulsión de 378 m en PEAD DN160. Curva de
 * bomba ilustrativa, no de un modelo real.
 */
const CURVA_EJEMPLO: string[][] = [
  ["0", "12,5", "0", ""],
  ["5", "11,7", "45", ""],
  ["10", "9,9", "62", ""],
  ["15", "7,3", "65", ""],
  ["20", "3,9", "54", ""],
];

const TRAMOS_EJEMPLO: TramoUI[] = [
  {
    id: "t1",
    nombre: "Colector de bomba PEAD DN110",
    materialId: "pvc",
    dn: "110",
    espesor: "6,6",
    longitud: "4",
    rugosidad: "0,0015",
    hazenC: "150",
    perdidaFija: "0,02",
    porBomba: true,
    cantidades: { entrada: "1", reduccion: "3", "te-directa": "2", "codo-90": "2", valvula: "1", retencion: "1" },
    kExtra: "",
  },
  {
    id: "t2",
    nombre: "Impulsión PEAD DN160",
    materialId: "pvc",
    dn: "160",
    espesor: "9,5",
    longitud: "378",
    rugosidad: "0,0015",
    hazenC: "150",
    perdidaFija: "",
    porBomba: false,
    cantidades: { reduccion: "1", "codo-90": "2", valvula: "2", salida: "1" },
    kExtra: "",
  },
];

const SUCCION_EJEMPLO: TramoUI = {
  id: "s",
  nombre: "Succión",
  materialId: "pvc",
  dn: "125",
  espesor: "6",
  longitud: "6",
  rugosidad: "0,0015",
  hazenC: "150",
  perdidaFija: "",
  porBomba: true,
  cantidades: { pie: "1", "codo-90": "1", reduccion: "1" },
  kExtra: "",
};

const TRAMOS_JSON = JSON.stringify(TRAMOS_EJEMPLO);
const SUCCION_JSON = JSON.stringify(SUCCION_EJEMPLO);
const K_JSON = JSON.stringify(Object.fromEntries(ACCESORIOS.map((a) => [a.id, String(a.k).replace(".", ",")])));

function leerJson<T>(texto: string, porDefecto: T): T {
  try {
    return JSON.parse(texto) as T;
  } catch {
    return porDefecto;
  }
}

function plantillaBomba(): TablaSalida[] {
  return [
    {
      hoja: "Curva de la bomba",
      encabezados: COLUMNAS_CURVA_BOMBA.map((c) => c.nombre),
      filas: CURVA_EJEMPLO.map((f) => f.map((x) => numeroDeCelda(x))),
      formatos: ["0.0", "0.00", "0.0", "0.00"],
    },
    {
      hoja: "Instrucciones",
      encabezados: ["columna", "contenido", "unidad"],
      filas: [
        ["caudal_ls", "Caudal de UNA bomba, punto de catálogo", "L/s"],
        ["altura_m", "Altura manométrica de la bomba en ese caudal", "m"],
        ["rendimiento_pct", "Opcional: rendimiento de la bomba", "%"],
        ["npshr_m", "Opcional: NPSH requerido (sólo bombas de aspiración)", "m"],
      ],
    },
  ];
}

const NOMBRE_NIVEL = { minimo: "nivel mínimo", medio: "nivel medio", maximo: "nivel máximo" } as const;

export default function BombeoPozoPage() {
  const [metodoNombre, setMetodoNombre] = useCampo("metodo", "Hazen-Williams");
  const [tipoNombre, setTipoNombre] = useCampo("tipo", "Bomba sumergible");
  const [varianteHw, setVarianteHw] = useCampo("varianteHw", "10,67 · (Q/C)^1,852 (SI)");
  const [gTexto, setG] = useCampo("g", "9,81");
  const [densidadTexto, setDensidad] = useCampo("densidad", "1000");
  const [temperaturaTexto, setTemperatura] = useCampo("temperatura", "20");
  const [caudalTexto, setCaudal] = useCampo("caudal", "12,5");
  const [nOperacionTexto, setNOperacion] = useCampo("nOperacion", "1");
  const [nInstaladasTexto, setNInstaladas] = useCampo("nInstaladas", "2");
  const [cotaMinTexto, setCotaMin] = useCampo("cotaMin", "1,43");
  const [cotaMaxTexto, setCotaMax] = useCampo("cotaMax", "2,43");
  const [cotaDescargaTexto, setCotaDescarga] = useCampo("cotaDescarga", "5,79");
  const [presionDescargaTexto, setPresionDescarga] = useCampo("presionDescarga", "0");
  const [coefSegTexto, setCoefSeg] = useCampo("coefSeg", "1,1");
  const [etaBombaTexto, setEtaBomba] = useCampo("etaBomba", "65");
  const [etaMotorTexto, setEtaMotor] = useCampo("etaMotor", "70");
  // Aspiración
  const [cotaEjeTexto, setCotaEje] = useCampo("cotaEje", "3,1");
  const [altitudTexto, setAltitud] = useCampo("altitud", "0");
  const [npshrManualTexto, setNpshrManual] = useCampo("npshrManual", "");
  const [margenTexto, setMargen] = useCampo("margen", "0,5");
  // Sumergible
  const [cotaAdmisionTexto, setCotaAdmision] = useCampo("cotaAdmision", "1,1");
  const [sumergenciaTexto, setSumergencia] = useCampo("sumergencia", "0,3");
  // Tramos, accesorios y curva
  const [tramosJson, setTramosJson] = useCampo("tramos", TRAMOS_JSON);
  const [succionJson, setSuccionJson] = useCampo("succion", SUCCION_JSON);
  const [kJson, setKJson] = useCampo("kAccesorios", K_JSON);
  const [filasBomba, setFilasBomba] = useTabla("curvaBomba2", CURVA_EJEMPLO);
  const [gradoNombre, setGradoNombre] = useCampo("grado", "Grado 2 (parábola)");
  const [nivelDetalle, setNivelDetalle] = useCampo("nivelDetalle", "Nivel mínimo");

  const metodo = NOMBRE_METODO[metodoNombre] ?? "hazen-williams";
  const tipo = NOMBRE_TIPO[tipoNombre] ?? "sumergible";
  const grado: 2 | 3 = gradoNombre.startsWith("Grado 3") ? 3 : 2;
  const hw = VARIANTES_HW[varianteHw as keyof typeof VARIANTES_HW] ?? VARIANTES_HW["10,67 · (Q/C)^1,852 (SI)"];

  const tramosUI = useMemo(() => leerJson<TramoUI[]>(tramosJson, TRAMOS_EJEMPLO), [tramosJson]);
  const succionUI = useMemo(() => leerJson<TramoUI>(succionJson, SUCCION_EJEMPLO), [succionJson]);
  const kTexto = useMemo(() => leerJson<Record<string, string>>(kJson, {}), [kJson]);
  const kCatalogo = useMemo(
    () => Object.fromEntries(ACCESORIOS.map((a) => [a.id, kTexto[a.id] !== undefined ? aNumero(kTexto[a.id]) : a.k])),
    [kTexto]
  );
  const setTramos = (t: TramoUI[]) => setTramosJson(JSON.stringify(t));

  const validacionCurva = useMemo(() => validarCurvaBomba(filasBomba, grado), [filasBomba, grado]);

  const errores: string[] = [];
  const num = (t: string, nombre: string, opciones: { min?: number; positivo?: boolean } = {}) => {
    const v = aNumero(t);
    if (!Number.isFinite(v)) errores.push(`${nombre} no es un número.`);
    else if (opciones.positivo && v <= 0) errores.push(`${nombre} tiene que ser mayor que cero.`);
    else if (opciones.min !== undefined && v < opciones.min) errores.push(`${nombre} no puede ser menor que ${opciones.min}.`);
    return v;
  };

  const aTramo = (t: TramoUI): TramoTuberia => {
    const dInt = diametroInteriorMm(t);
    if (!(dInt > 0)) errores.push(`«${t.nombre}»: el diámetro interior tiene que ser mayor que cero.`);
    const longitudM = num(t.longitud, `«${t.nombre}»: la longitud`, { positivo: true });
    const sumaK = sumaKTramo(t, kCatalogo);
    if (!Number.isFinite(sumaK)) errores.push(`«${t.nombre}»: revisá las cantidades de accesorios.`);
    return {
      nombre: t.nombre,
      longitudM,
      diametroMm: dInt,
      rugosidadMm: metodo === "darcy-weisbach" ? num(t.rugosidad, `«${t.nombre}»: la rugosidad`, { min: 0 }) : 0,
      hazenC: metodo === "hazen-williams" ? num(t.hazenC, `«${t.nombre}»: el coeficiente C`, { positivo: true }) : 150,
      sumaK,
      perdidaFijaM: t.perdidaFija.trim() === "" ? 0 : num(t.perdidaFija, `«${t.nombre}»: la pérdida fija`, { min: 0 }),
      porBomba: t.porBomba,
    };
  };

  const impulsion = tramosUI.map(aTramo);
  if (impulsion.length === 0) errores.push("Agregá al menos un tramo de impulsión.");
  const succion = tipo === "aspiracion" ? aTramo(succionUI) : null;
  const npshrManual = npshrManualTexto.trim() === "" ? null : num(npshrManualTexto, "El NPSHr fijo", { min: 0 });
  const nOperacion = Math.round(num(nOperacionTexto, "Las bombas en operación", { positivo: true }));
  const nInstaladas = Math.round(num(nInstaladasTexto, "Las bombas instaladas", { positivo: true }));
  const cotaMin = num(cotaMinTexto, "La cota del nivel mínimo");
  const cotaMax = num(cotaMaxTexto, "La cota del nivel máximo");
  if (cotaMin > cotaMax) errores.push("El nivel mínimo no puede estar por encima del máximo.");

  const datosSinCurva: Omit<DatosBombeo, "curvaBomba"> = {
    tipo,
    hid: {
      metodo,
      temperaturaC: num(temperaturaTexto, "La temperatura"),
      g: num(gTexto, "La gravedad", { positivo: true }),
      hazenCoef: hw.coef,
      hazenExp: hw.exp,
      densidad: num(densidadTexto, "La densidad", { positivo: true }),
    },
    caudalDisenoLs: num(caudalTexto, "El caudal de diseño", { positivo: true }),
    bombasOperacion: nOperacion,
    bombasInstaladas: nInstaladas,
    cotaNivelMinimoM: cotaMin,
    cotaNivelMaximoM: cotaMax,
    cotaDescargaM: num(cotaDescargaTexto, "La cota de descarga"),
    presionDescargaM: num(presionDescargaTexto, "La presión en la descarga"),
    impulsion,
    succion,
    coefSeguridad: num(coefSegTexto, "El coeficiente de seguridad", { positivo: true }),
    cotaEjeBombaM: tipo === "aspiracion" ? num(cotaEjeTexto, "La cota del eje de la bomba") : 0,
    altitudMsnm: tipo === "aspiracion" ? num(altitudTexto, "La altitud") : 0,
    npshrManualM: npshrManual,
    margenNpshM: tipo === "aspiracion" ? num(margenTexto, "El margen de NPSH", { min: 0 }) : 0,
    cotaAdmisionM: tipo === "sumergible" ? num(cotaAdmisionTexto, "La cota de la admisión") : 0,
    sumergenciaMinimaM: tipo === "sumergible" ? num(sumergenciaTexto, "La sumergencia mínima", { min: 0 }) : 0,
    gradoAjuste: grado,
    rendimientoBombaPct: num(etaBombaTexto, "El rendimiento de la bomba", { positivo: true }),
    rendimientoMotorPct: num(etaMotorTexto, "El rendimiento del motor", { positivo: true }),
  };

  const datos: DatosBombeo | null =
    errores.length === 0 && validacionCurva.puntos ? { ...datosSinCurva, curvaBomba: validacionCurva.puntos } : null;
  const resultado = datos ? calcularBombeo(datos) : null;
  const nivelSel = nivelDetalle === "Nivel máximo" ? "maximo" : nivelDetalle === "Nivel medio" ? "medio" : "minimo";
  const velocidades = resultado?.alturas.minimo.perdidas.impulsion.map((t) => t.velocidadMs) ?? [];

  const llevarAGolpe = () => {
    if (!resultado || !datos) return;
    // El tramo más largo que lleva el caudal total es el que manda en el golpe de ariete.
    const candidatos = tramosUI.map((t, i) => ({ t, tramo: impulsion[i] })).filter((x) => !x.tramo.porBomba);
    const principal = (candidatos.length ? candidatos : tramosUI.map((t, i) => ({ t, tramo: impulsion[i] }))).sort(
      (a, b) => b.tramo.longitudM - a.tramo.longitudM
    )[0];
    escribirCampos(metaGolpe.ruta, {
      caudal: caudalTexto,
      dn: principal.t.dn,
      espesor: principal.t.espesor,
      longitud: principal.t.longitud,
      hServicio: String(+resultado.alturas.minimo.alturaTotalM.toFixed(2)).replace(".", ","),
      hEstatica: String(+resultado.alturas.minimo.alturaEstaticaM.toFixed(2)).replace(".", ","),
    });
  };

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
            <p className="spec-label">Caudal y bombas</p>
            <CampoSeleccion
              id="tipo"
              etiqueta="Tipo de instalación"
              valor={ETIQUETA_TIPO[tipo]}
              opciones={Object.keys(NOMBRE_TIPO)}
              onChange={setTipoNombre}
            />
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="caudal" etiqueta="Caudal de diseño" sufijo="L/s" valor={caudalTexto} onChange={setCaudal} />
              <CampoNumerico id="nOperacion" etiqueta="Bombas en operación" valor={nOperacionTexto} onChange={setNOperacion} />
              <CampoNumerico id="nInstaladas" etiqueta="Bombas instaladas" valor={nInstaladasTexto} onChange={setNInstaladas} />
            </div>
            {resultado && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Caudal por bomba {fmt(resultado.caudalBombaLs, 2)} L/s ({fmt(resultado.caudalBombaLs * 3.6, 1)} m³/h);{" "}
                {resultado.bombasReserva} de reserva.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="spec-label">Niveles y descarga</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumerico id="cotaMin" etiqueta="Cota nivel mínimo" sufijo="m" valor={cotaMinTexto} onChange={setCotaMin} />
              <CampoNumerico id="cotaMax" etiqueta="Cota nivel máximo" sufijo="m" valor={cotaMaxTexto} onChange={setCotaMax} />
              <CampoNumerico id="cotaDescarga" etiqueta="Cota de descarga" sufijo="m" valor={cotaDescargaTexto} onChange={setCotaDescarga} />
              <CampoNumerico
                id="presionDescarga"
                etiqueta="Presión en la descarga"
                sufijo="m.c.a."
                valor={presionDescargaTexto}
                onChange={setPresionDescarga}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Niveles del agua en el pozo (en un pozo de agua subterránea, el mínimo es el dinámico). Los podés traer de la
              calculadora de{" "}
              <Link href="/calculadoras/pozo-humedo" className="underline underline-offset-2 hover:text-foreground">
                pozo de bombeo
              </Link>
              . Presión en la descarga: 0 si descarga libre.
            </p>
            {tipo === "aspiracion" ? (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="cotaEje" etiqueta="Cota del eje de la bomba" sufijo="m" valor={cotaEjeTexto} onChange={setCotaEje} />
                <CampoNumerico id="altitud" etiqueta="Altitud del sitio" sufijo="m s.n.m." valor={altitudTexto} onChange={setAltitud} />
                <CampoNumerico id="margen" etiqueta="Margen NPSHd − NPSHr" sufijo="m" valor={margenTexto} onChange={setMargen} />
                <CampoNumerico id="npshrManual" etiqueta="NPSHr fijo (opcional)" sufijo="m" valor={npshrManualTexto} onChange={setNpshrManual} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <CampoNumerico id="cotaAdmision" etiqueta="Cota de la admisión" sufijo="m" valor={cotaAdmisionTexto} onChange={setCotaAdmision} />
                <CampoNumerico id="sumergencia" etiqueta="Sumergencia mínima" sufijo="m" valor={sumergenciaTexto} onChange={setSumergencia} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="spec-label">Impulsión, por tramos en serie</p>
            {tramosUI.map((t, i) => (
              <EditorTramo
                key={t.id}
                tramo={t}
                metodo={metodo}
                kCatalogo={kCatalogo}
                velocidadMs={velocidades[i]}
                ocultar={["pie"]}
                onChange={(nuevo) => setTramos(tramosUI.map((x, j) => (j === i ? nuevo : x)))}
                onQuitar={tramosUI.length > 1 ? () => setTramos(tramosUI.filter((_, j) => j !== i)) : undefined}
                onDuplicar={() =>
                  setTramos([
                    ...tramosUI.slice(0, i + 1),
                    { ...t, id: `t${Date.now()}`, nombre: `${t.nombre} (copia)` },
                    ...tramosUI.slice(i + 1),
                  ])
                }
              />
            ))}
            <button
              type="button"
              className={botonArchivo}
              onClick={() =>
                setTramos([
                  ...tramosUI,
                  { ...TRAMOS_EJEMPLO[1], id: `t${Date.now()}`, nombre: `Tramo ${tramosUI.length + 1}`, cantidades: {} },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar tramo
            </button>
            {tipo === "aspiracion" && (
              <>
                <p className="spec-label pt-2">Succión de cada bomba</p>
                <EditorTramo
                  tramo={succionUI}
                  metodo={metodo}
                  kCatalogo={kCatalogo}
                  mostrarPorBomba={false}
                  velocidadMs={resultado?.alturas.minimo.perdidas.succion?.velocidadMs}
                  onChange={(t) => setSuccionJson(JSON.stringify(t))}
                />
              </>
            )}
            <details className="rounded-lg border border-border/70 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                Coeficientes K del catálogo de accesorios
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {ACCESORIOS.map((a) => (
                  <label key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{a.nombre}</span>
                    <input
                      inputMode="decimal"
                      aria-label={`K de ${a.nombre}`}
                      value={kTexto[a.id] ?? String(a.k).replace(".", ",")}
                      onChange={(e) => setKJson(JSON.stringify({ ...kTexto, [a.id]: e.target.value }))}
                      className="h-7 w-16 rounded-sm border border-input bg-background px-1.5 text-right font-mono text-[13px] tabular-nums outline-none focus:border-ring"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Valores de uso habitual; cambialos por los del fabricante si los tenés. Valen para todos los tramos.
              </p>
            </details>
          </div>

          <div className="space-y-4">
            <p className="spec-label">Rendimientos y opciones de cálculo</p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="etaBomba" etiqueta="η bomba" sufijo="%" valor={etaBombaTexto} onChange={setEtaBomba} />
              <CampoNumerico id="etaMotor" etiqueta="η motor" sufijo="%" valor={etaMotorTexto} onChange={setEtaMotor} />
              <CampoNumerico id="coefSeg" etiqueta="Coef. de seguridad" valor={coefSegTexto} onChange={setCoefSeg} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              η bomba se usa si la curva no trae rendimiento. η motor puede ser el mecánico de la transmisión. El coeficiente de
              seguridad multiplica la altura máxima para elegir la bomba.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumerico id="temperatura" etiqueta="Temperatura" sufijo="°C" valor={temperaturaTexto} onChange={setTemperatura} />
              <CampoNumerico id="densidad" etiqueta="Densidad" sufijo="kg/m³" valor={densidadTexto} onChange={setDensidad} />
              <CampoNumerico id="g" etiqueta="Gravedad g" sufijo="m/s²" valor={gTexto} onChange={setG} />
            </div>
            {metodo === "hazen-williams" && (
              <CampoSeleccion
                id="varianteHw"
                etiqueta="Fórmula de Hazen-Williams (J en m/m, Q en m³/s, D en m)"
                valor={varianteHw in VARIANTES_HW ? varianteHw : "10,67 · (Q/C)^1,852 (SI)"}
                opciones={Object.keys(VARIANTES_HW)}
                onChange={setVarianteHw}
              />
            )}
          </div>

          <div className="space-y-3">
            <p className="spec-label">Curva de la bomba (opcional)</p>
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
              Puntos de catálogo de UNA bomba. η y NPSHr son opcionales. Sin curva (tabla vacía) se calculan igual la altura y la
              potencia para pedir la bomba.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <CampoSeleccion
                  id="grado"
                  etiqueta="Ajuste polinómico"
                  valor={grado === 3 ? "Grado 3 (cúbica)" : "Grado 2 (parábola)"}
                  opciones={["Grado 2 (parábola)", "Grado 3 (cúbica)"]}
                  onChange={setGradoNombre}
                />
              </div>
              <button type="button" className={`${botonArchivo} mb-0.5`} onClick={() => setFilasBomba([])}>
                Vaciar curva
              </button>
            </div>
            <ListaErrores titulo="Errores en la curva de la bomba" errores={validacionCurva.errores} />
          </div>
        </div>

        <div className="space-y-6">
          <ListaErrores titulo="Revisá los datos" errores={errores} />
          {!resultado || !datos ? (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              Completá los datos para calcular la altura de bombeo y la potencia.
            </div>
          ) : (
            <Resultados
              datos={datos}
              resultado={resultado}
              nivelSel={nivelSel}
              nivelDetalle={nivelDetalle}
              setNivelDetalle={setNivelDetalle}
              llevarAGolpe={llevarAGolpe}
            />
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
  llevarAGolpe,
}: {
  datos: DatosBombeo;
  resultado: ResultadoBombeo;
  nivelSel: "minimo" | "medio" | "maximo";
  nivelDetalle: string;
  setNivelDetalle: (v: string) => void;
  llevarAGolpe: () => void;
}) {
  const { alturas, diseno, curva } = resultado;
  const n = Math.max(1, datos.bombasOperacion);
  const qTope = Math.max((curva?.caudalMaxCurvaLs ?? 0) * n, datos.caudalDisenoLs * 1.4);
  const muestras = 80;
  const qs = Array.from({ length: muestras + 1 }, (_, i) => (qTope * i) / muestras);
  const qsBomba = curva
    ? Array.from(
        { length: muestras + 1 },
        (_, i) => (curva.caudalMinCurvaLs + ((curva.caudalMaxCurvaLs - curva.caudalMinCurvaLs) * i) / muestras) * n
      )
    : [];
  const { minimo, maximo } = resultado.niveles;
  const etiquetaCurva = n > 1 ? `${n} bombas en paralelo (ajuste)` : "Bomba (ajuste)";

  const seriesH: SerieGrafico[] = [
    ...(curva
      ? [
          {
            id: "bomba",
            nombre: etiquetaCurva,
            color: "var(--serie-1)",
            puntos: qsBomba.map((q) => ({ x: q, y: evaluarPolinomio(curva.ajusteH.coef, q / n) })),
          },
        ]
      : []),
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
    ...(curva
      ? [
          {
            id: "catalogo",
            nombre: "Puntos de catálogo",
            color: "var(--serie-1)",
            soloMarcadores: true,
            sinTooltip: true,
            puntos: datos.curvaBomba.map((p) => ({ x: p.caudalLs * n, y: p.alturaM })).sort((a, b) => a.x - b.x),
          },
        ]
      : []),
  ];

  const destacados = curva
    ? [
        ...(minimo.operacion
          ? [{ x: minimo.operacion.caudalTotalLs, y: minimo.operacion.alturaM, etiqueta: "A · nivel mín.", color: "var(--serie-2)" }]
          : []),
        ...(maximo.operacion
          ? [{ x: maximo.operacion.caudalTotalLs, y: maximo.operacion.alturaM, etiqueta: "B · nivel máx.", color: "var(--serie-3)" }]
          : []),
      ]
    : [
        {
          x: datos.caudalDisenoLs,
          y: resultado.alturaAjustadaM,
          etiqueta: `Pedido: ${fmt(datos.caudalDisenoLs, 1)} L/s a ${fmt(resultado.alturaAjustadaM, 1)} m`,
          color: "var(--foreground)",
        },
      ];

  const banda = curva
    ? {
        desde: curva.rangoRecomendadoLs[0] * n,
        hasta: curva.rangoRecomendadoLs[1] * n,
        etiqueta: curva.rangoSegun === "bep" ? "rango recomendado (70–120 % Q_BEP)" : "rango de la curva cargada",
      }
    : undefined;
  const fmtQ = (q: number) => fmt(q, q < 10 ? 1 : 0);

  const seriesNpsh: SerieGrafico[] | null =
    datos.tipo === "aspiracion" && curva
      ? [
          {
            id: "npshd-min",
            nombre: "NPSHd, nivel mínimo",
            color: "var(--serie-2)",
            puntos: qsBomba.map((q) => ({ x: q, y: npshDisponible(datos, datos.cotaNivelMinimoM, q / n).npshdM })),
          },
          {
            id: "npshd-max",
            nombre: "NPSHd, nivel máximo",
            color: "var(--serie-3)",
            discontinua: true,
            puntos: qsBomba.map((q) => ({ x: q, y: npshDisponible(datos, datos.cotaNivelMaximoM, q / n).npshdM })),
          },
          ...(curva.ajusteNpshr
            ? [
                {
                  id: "npshr",
                  nombre: "NPSHr de la bomba",
                  color: "var(--serie-1)",
                  puntos: qsBomba.map((q) => ({ x: q, y: Math.max(0, evaluarPolinomio(curva.ajusteNpshr!.coef, q / n)) })),
                },
              ]
            : []),
        ]
      : null;

  const filasAltura: [string, (k: "minimo" | "medio" | "maximo") => string][] = [
    ["Cota del agua", (k) => `${fmt(alturas[k].cotaAguaM, 2)} m`],
    ["Altura estática", (k) => `${fmt(alturas[k].alturaEstaticaM, 3)} m`],
    ...alturas.minimo.perdidas.impulsion.map(
      (t, i) => [`Pérdidas · ${t.nombre}`, (k: "minimo" | "medio" | "maximo") => `${fmt(alturas[k].perdidas.impulsion[i].totalM, 3)} m`] as [
        string,
        (k: "minimo" | "medio" | "maximo") => string,
      ]
    ),
    ...(alturas.minimo.perdidas.succion
      ? ([["Pérdidas · succión", (k) => `${fmt(alturas[k].perdidas.succion!.totalM, 3)} m`]] as [
          string,
          (k: "minimo" | "medio" | "maximo") => string,
        ][])
      : []),
    ["Altura manométrica total", (k) => `${fmt(alturas[k].alturaTotalM, 3)} m`],
  ];

  return (
    <>
      <PanelMetricas
        horizontal
        metricas={[
          {
            etiqueta: "H máxima (nivel mín.)",
            valor: `${fmt(alturas.minimo.alturaTotalM, 2)} m`,
            nota: `media ${fmt(alturas.medio.alturaTotalM, 2)} · mín. ${fmt(alturas.maximo.alturaTotalM, 2)} m`,
          },
          {
            etiqueta: "Pedido por bomba",
            valor: `${fmt(resultado.caudalBombaLs, 1)} L/s`,
            nota: `a ${fmt(resultado.alturaAjustadaM, 2)} m (× ${fmt(datos.coefSeguridad, 2)})`,
            destacada: true,
          },
          {
            etiqueta: "Potencia del motor",
            valor: `${fmt(diseno.potenciaMotorKw, 2)} kW`,
            nota: diseno.motorComercialKw ? `motor normalizado ${fmt(diseno.motorComercialKw, diseno.motorComercialKw < 1 ? 2 : 1)} kW` : undefined,
          },
          ...(curva && minimo.operacion && maximo.operacion
            ? [
                {
                  etiqueta: "Q de operación (A–B)",
                  valor: `${fmt(minimo.operacion.caudalTotalLs, 1)}–${fmt(maximo.operacion.caudalTotalLs, 1)}`,
                  nota: "L/s, entre nivel mín. y máx.",
                },
              ]
            : [
                {
                  etiqueta: "Potencia total",
                  valor: `${fmt(diseno.potenciaTotalKw, 2)} kW`,
                  nota: `${n} en operación`,
                },
              ]),
        ]}
      />

      <DiagramaBombeo
        tipo={datos.tipo}
        bombasOperacion={n}
        bombasInstaladas={datos.bombasInstaladas}
        caudalTotalLs={datos.caudalDisenoLs}
        caudalBombaLs={resultado.caudalBombaLs}
        cotaNivelMinimoM={datos.cotaNivelMinimoM}
        cotaNivelMaximoM={datos.cotaNivelMaximoM}
        cotaDescargaM={datos.cotaDescargaM}
        presionDescargaM={datos.presionDescargaM}
        cotaEjeBombaM={datos.cotaEjeBombaM}
        cotaAdmisionM={datos.cotaAdmisionM}
        tramos={datos.impulsion.map((t, i) => ({
          nombre: t.nombre,
          longitudM: t.longitudM,
          diametroMm: t.diametroMm,
          perdidaM: alturas.minimo.perdidas.impulsion[i]?.totalM ?? 0,
        }))}
        perdidaSuccionM={alturas.minimo.perdidas.succion?.totalM ?? 0}
        alturaTotalM={alturas.minimo.alturaTotalM}
      />

      <ListaAvisos avisos={resultado.avisos} />
      {curva &&
        [minimo, maximo]
          .filter((x) => x.motivoSinOperacion)
          .map((x) => (
            <ListaErrores key={x.nivel} titulo={`Sin punto de operación con ${NOMBRE_NIVEL[x.nivel]}`} errores={[x.motivoSinOperacion!]} />
          ))}

      <GraficoLineas
        titulo={curva ? "Curvas de la bomba y del sistema" : "Curvas del sistema y punto pedido"}
        series={seriesH}
        destacados={destacados}
        bandaX={banda}
        formatoX={fmtQ}
        formatoY={(h) => fmt(h, 0)}
        formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
        formatoValor={(h) => `${fmt(h, 2)} m`}
        ejeX="Caudal total Q (L/s)"
        ejeY="Altura H (m)"
        desdeCero
        alto={300}
      />

      {curva?.ajusteRendimiento && (
        <GraficoLineas
          titulo="Rendimiento de la bomba"
          series={[
            {
              id: "eta",
              nombre: "η",
              color: "var(--serie-1)",
              puntos: qsBomba.map((q) => ({ x: q, y: Math.max(0, evaluarPolinomio(curva.ajusteRendimiento!.coef, q / n)) })),
            },
          ]}
          destacados={[minimo, maximo]
            .filter((x) => x.operacion)
            .map((x) => ({
              x: x.operacion!.caudalTotalLs,
              y: x.operacion!.rendimientoPct,
              etiqueta: x.nivel === "minimo" ? "A" : "B",
              color: x.nivel === "minimo" ? "var(--serie-2)" : "var(--serie-3)",
            }))}
          bandaX={banda}
          formatoX={fmtQ}
          formatoY={(e) => `${fmt(e, 0)} %`}
          formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
          formatoValor={(e) => `${fmt(e, 1)} %`}
          ejeX="Caudal total Q (L/s)"
          ejeY="Rendimiento η (%)"
          desdeCero
          alto={200}
        />
      )}

      {seriesNpsh && (
        <GraficoLineas
          titulo="NPSH disponible y requerido"
          series={seriesNpsh}
          formatoX={fmtQ}
          formatoY={(h) => fmt(h, 1)}
          formatoXTooltip={(q) => `Q = ${fmt(q, 2)} L/s`}
          formatoValor={(h) => `${fmt(h, 2)} m`}
          ejeX="Caudal total Q (L/s)"
          ejeY="NPSH (m)"
          alto={200}
        />
      )}

      <TablaResultados
        titulo={`Altura con el caudal de diseño (${fmt(datos.caudalDisenoLs, 2)} L/s)`}
        columnas={["Nivel mínimo", "Nivel medio", "Nivel máximo"]}
        filas={filasAltura.map(([e, f]) => [e, f("minimo"), f("medio"), f("maximo")])}
        pie={`Altura ajustada para elegir la bomba: ${fmt(alturas.minimo.alturaTotalM, 3)} × ${fmt(datos.coefSeguridad, 2)} = ${fmt(resultado.alturaAjustadaM, 3)} m.`}
      />

      <TablaResultados
        titulo="Potencia (con la altura máxima)"
        columnas={["Valor"]}
        filas={[
          ["Potencia hidráulica por bomba", `${fmt(diseno.potenciaHidraulicaKw, 3)} kW`],
          [`Rendimiento de la bomba${diseno.rendimientoDeCurva ? " (de la curva)" : ""}`, `${fmt(diseno.rendimientoPct, 1)} %`],
          ["Potencia al eje", `${fmt(diseno.potenciaEjeKw, 3)} kW`],
          ["Rendimiento del motor", `${fmt(datos.rendimientoMotorPct, 1)} %`],
          ["Potencia del motor", `${fmt(diseno.potenciaMotorKw, 3)} kW`],
          ["Motor normalizado (IEC)", diseno.motorComercialKw ? `${fmt(diseno.motorComercialKw, 2)} kW` : "—"],
          [`Potencia total (${n} en operación)`, `${fmt(diseno.potenciaTotalKw, 3)} kW`],
        ]}
      />

      {curva && (
        <TablaResultados
          titulo="Punto de operación"
          columnas={["Nivel mínimo", "Nivel máximo"]}
          filas={(
            [
              ["Q total", (x) => (x.operacion ? `${fmt(x.operacion.caudalTotalLs, 2)} L/s` : "—")],
              ["Q por bomba", (x) => (x.operacion ? `${fmt(x.operacion.caudalBombaLs, 2)} L/s` : "—")],
              ["H de operación", (x) => (x.operacion ? `${fmt(x.operacion.alturaM, 2)} m` : "—")],
              ["Rendimiento η", (x) => (x.operacion ? `${fmt(x.operacion.rendimientoPct, 1)} %` : "—")],
              ["Potencia al eje por bomba", (x) => (x.operacion ? `${fmt(x.operacion.potenciaEjeKw, 2)} kW` : "—")],
              ["Potencia del motor por bomba", (x) => (x.operacion ? `${fmt(x.operacion.potenciaMotorKw, 2)} kW` : "—")],
              ["Dentro del rango recomendado", (x) => (x.operacion ? (x.operacion.enRango ? "Sí" : "No") : "—")],
            ] as [string, (x: typeof minimo) => string][]
          ).map(([e, f]) => [e, f(minimo), f(maximo)])}
          pie={
            curva.rangoSegun === "bep"
              ? `Máximo rendimiento ${fmt(curva.rendimientoBepPct ?? NaN, 1)} % en Q_BEP = ${fmt(curva.caudalBepLs ?? NaN, 1)} L/s por bomba; rango recomendado ${fmt(curva.rangoRecomendadoLs[0], 1)} a ${fmt(curva.rangoRecomendadoLs[1], 1)} L/s.`
              : `Sin curva de rendimiento, el rango recomendado es el de la curva cargada; la potencia usa η = ${fmt(datos.rendimientoBombaPct, 0)} %.`
          }
        />
      )}

      <TablaResultados
        titulo={datos.tipo === "aspiracion" ? "Verificación de NPSH (con el caudal de operación por bomba)" : "Verificación de sumergencia"}
        columnas={["Nivel mínimo", "Nivel máximo"]}
        filas={
          datos.tipo === "aspiracion"
            ? (
                [
                  ["Q por bomba", (x) => `${fmt(x.npsh!.caudalBombaLs, 2)} L/s`],
                  ["NPSH disponible", (x) => `${fmt(x.npsh!.npshdM, 2)} m`],
                  ["NPSH requerido", (x) => (x.npsh!.npshrM !== null ? `${fmt(x.npsh!.npshrM, 2)} m` : "—")],
                  [`NPSHd ≥ NPSHr + ${fmt(datos.margenNpshM, 1)} m`, (x) => (x.npsh!.cumple === null ? "—" : x.npsh!.cumple ? "Sí" : "No")],
                ] as [string, (x: typeof minimo) => string][]
              ).map(([e, f]) => [e, f(minimo), f(maximo)])
            : (
                [
                  ["Sumergencia disponible", (x) => `${fmt(x.sumergencia!.disponibleM, 2)} m`],
                  [`S ≥ ${fmt(datos.sumergenciaMinimaM, 2)} m`, (x) => (x.sumergencia!.cumple ? "Sí" : "No")],
                ] as [string, (x: typeof minimo) => string][]
              ).map(([e, f]) => [e, f(minimo), f(maximo)])
        }
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-48 print:hidden">
            <CampoSeleccion
              id="nivelDetalle"
              etiqueta="Detallar el cálculo con"
              valor={nivelDetalle === "Nivel máximo" ? "Nivel máximo" : nivelDetalle === "Nivel medio" ? "Nivel medio" : "Nivel mínimo"}
              opciones={["Nivel mínimo", "Nivel medio", "Nivel máximo"]}
              onChange={setNivelDetalle}
            />
          </div>
          <Link
            href="/calculadoras/golpe-ariete"
            onClick={llevarAGolpe}
            className={`${botonArchivo} print:hidden`}
            title="Pasa caudal, tubería principal y altura a la calculadora de golpe de ariete"
          >
            Verificar golpe de ariete
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <PanelFormulas titulo={`Ver cálculo · ${NOMBRE_NIVEL[nivelSel]}`} filas={filasDetalle(datos, resultado, nivelSel)} />
      </div>
    </>
  );
}

function TablaResultados({
  titulo,
  columnas,
  filas,
  pie,
}: {
  titulo: string;
  columnas: string[];
  filas: string[][];
  pie?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full border-collapse text-sm">
          <caption className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-left text-xs font-medium">{titulo}</caption>
          {columnas.length > 1 && (
            <thead className="text-[11px] text-muted-foreground">
              <tr>
                <th scope="col" />
                {columnas.map((c) => (
                  <th key={c} scope="col" className="px-2.5 py-1 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="font-mono text-[13px] tabular-nums">
            {filas.map(([etiqueta, ...valores]) => (
              <tr key={etiqueta} className="border-t border-border/40">
                <th scope="row" className="px-2.5 py-1 text-left font-sans text-xs font-normal text-muted-foreground">
                  {etiqueta}
                </th>
                {valores.map((v, i) => (
                  <td key={i} className={`px-2.5 py-1 text-right ${v === "No" ? "font-semibold text-destructive" : ""}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pie && <p className="text-[11px] text-muted-foreground">{pie}</p>}
    </div>
  );
}

function filasTramo(t: PerdidasTramo, tramo: TramoTuberia, datos: DatosBombeo) {
  const D = tramo.diametroMm / 1000;
  const Q = t.caudalLs / 1000;
  const g = fmt(datos.hid.g, 2);
  const filas: { etiqueta: string; formula?: string; sustitucion?: string; valor: string }[] = [
    {
      etiqueta: `${t.nombre} · V`,
      formula: "Q / (π·D²/4)",
      sustitucion: `${fmt(Q, 5)} / (π·${fmt(D, 4)}²/4)${tramo.porBomba && datos.bombasOperacion > 1 ? "  (Q de una bomba)" : ""}`,
      valor: `${fmt(t.velocidadMs, 3)} m/s`,
    },
    datos.hid.metodo === "darcy-weisbach"
      ? {
          etiqueta: `${t.nombre} · hf`,
          formula: "f·(L/D)·V²/(2g), f por Colebrook-White",
          sustitucion: `${fmt(t.factorFriccion ?? NaN, 4)} · (${fmt(tramo.longitudM, 1)}/${fmt(D, 4)}) · ${fmt(t.velocidadMs, 3)}²/(2·${g})   Re = ${fmt(t.reynolds ?? NaN, 0)}`,
          valor: `${fmt(t.friccionM, 3)} m`,
        }
      : {
          etiqueta: `${t.nombre} · hf`,
          formula: `${fmt(datos.hid.hazenCoef, 3)}·L·(Q/C)^${fmt(datos.hid.hazenExp, 3)} / D^4,87`,
          sustitucion: `${fmt(datos.hid.hazenCoef, 3)} · ${fmt(tramo.longitudM, 1)} · (${fmt(Q, 5)}/${fmt(tramo.hazenC, 0)})^${fmt(datos.hid.hazenExp, 3)} / ${fmt(D, 4)}^4,87   (J = ${fmt(t.pendienteMKm, 2)} m/km)`,
          valor: `${fmt(t.friccionM, 3)} m`,
        },
    {
      etiqueta: `${t.nombre} · hl`,
      formula: "ΣK·V²/(2g)",
      sustitucion: `${fmt(tramo.sumaK, 2)} · ${fmt(t.velocidadMs, 3)}²/(2·${g})`,
      valor: `${fmt(t.localizadaM, 3)} m`,
    },
  ];
  if (tramo.perdidaFijaM > 0) {
    filas.push({ etiqueta: `${t.nombre} · pérdida fija`, valor: `${fmt(t.fijaM, 3)} m` });
  }
  return filas;
}

function filasDetalle(datos: DatosBombeo, resultado: ResultadoBombeo, nivel: "minimo" | "medio" | "maximo") {
  const a = resultado.alturas[nivel];
  const filas: { etiqueta: string; formula?: string; sustitucion?: string; valor: string }[] = [];
  filas.push({
    etiqueta: "H_est",
    formula: "z_descarga − z_agua + p_descarga/γ",
    sustitucion: `${fmt(datos.cotaDescargaM, 2)} − ${fmt(a.cotaAguaM, 3)} + ${fmt(datos.presionDescargaM, 2)}`,
    valor: `${fmt(a.alturaEstaticaM, 3)} m`,
  });
  const p = perdidasSistema(datos, datos.caudalDisenoLs);
  p.impulsion.forEach((t, i) => filas.push(...filasTramo(t, datos.impulsion[i], datos)));
  if (p.succion && datos.succion) filas.push(...filasTramo(p.succion, { ...datos.succion, porBomba: true }, datos));
  filas.push({
    etiqueta: "H total",
    formula: "H_est + Σ (hf + hl + fija)",
    sustitucion: `${fmt(a.alturaEstaticaM, 3)} + ${fmt(a.perdidas.totalM, 3)}`,
    valor: `${fmt(a.alturaTotalM, 3)} m`,
  });
  filas.push({
    etiqueta: "H ajustada",
    formula: "H_máx · coef. de seguridad",
    sustitucion: `${fmt(resultado.alturas.minimo.alturaTotalM, 3)} · ${fmt(datos.coefSeguridad, 2)}`,
    valor: `${fmt(resultado.alturaAjustadaM, 3)} m`,
  });
  const d = resultado.diseno;
  filas.push(
    {
      etiqueta: "P_hidráulica",
      formula: "ρ·g·Q_bomba·H_máx",
      sustitucion: `${fmt(datos.hid.densidad, 1)} · ${fmt(datos.hid.g, 2)} · ${fmt(resultado.caudalBombaLs / 1000, 5)} · ${fmt(resultado.alturas.minimo.alturaTotalM, 3)} / 1000`,
      valor: `${fmt(d.potenciaHidraulicaKw, 3)} kW`,
    },
    {
      etiqueta: "P_eje",
      formula: "P_hidráulica / η_bomba",
      sustitucion: `${fmt(d.potenciaHidraulicaKw, 3)} / ${fmt(d.rendimientoPct / 100, 3)}`,
      valor: `${fmt(d.potenciaEjeKw, 3)} kW`,
    },
    {
      etiqueta: "P_motor",
      formula: "P_eje / η_motor",
      sustitucion: `${fmt(d.potenciaEjeKw, 3)} / ${fmt(datos.rendimientoMotorPct / 100, 3)}`,
      valor: `${fmt(d.potenciaMotorKw, 3)} kW → normalizado ${d.motorComercialKw ? fmt(d.motorComercialKw, 2) : "—"} kW`,
    }
  );

  const c = resultado.curva;
  const nivelOp = nivel === "medio" ? null : resultado.niveles[nivel];
  if (c) {
    const terminos = c.ajusteH.coef
      .map((x, i) => (i === 0 ? fmt(x, 3) : `${x < 0 ? "−" : "+"} ${fmt(Math.abs(x), i === 1 ? 4 : 6)}·q${i === 1 ? "" : i === 2 ? "²" : "³"}`))
      .join(" ");
    filas.push({
      etiqueta: "Curva de una bomba",
      formula: c.ajusteH.coef.length === 3 ? "a₀ + a₁·q + a₂·q²" : "a₀ + a₁·q + a₂·q² + a₃·q³",
      sustitucion: `H(q) = ${terminos}`,
      valor: `R² = ${fmt(c.ajusteH.r2, 4)}`,
    });
    if (nivelOp?.operacion) {
      const op = nivelOp.operacion;
      const n = Math.max(1, datos.bombasOperacion);
      filas.push({
        etiqueta: "Punto de operación",
        formula: n > 1 ? `H(Q/${n}) = H_sistema(Q), por bisección` : "H(Q) = H_sistema(Q), por bisección",
        sustitucion: `H(${fmt(op.caudalBombaLs, 2)}) = ${fmt(op.alturaM, 3)} ≈ H_sist(${fmt(op.caudalTotalLs, 2)}) = ${fmt(alturaSistema(datos, nivelOp.cotaAguaM, op.caudalTotalLs), 3)}`,
        valor: `Q = ${fmt(op.caudalTotalLs, 2)} L/s, H = ${fmt(op.alturaM, 2)} m`,
      });
    }
  }

  if (nivelOp?.npsh) {
    const np = nivelOp.npsh;
    const gamma = (datos.hid.densidad * datos.hid.g) / 1000;
    filas.push(
      {
        etiqueta: "p_atm/γ",
        formula: "101,325·(1 − 2,25577×10⁻⁵·z)^5,25588 / γ",
        sustitucion: `${fmt(presionAtmosfericaKPa(datos.altitudMsnm), 2)} kPa / ${fmt(gamma, 3)} kN/m³`,
        valor: `${fmt(np.patmM, 3)} m`,
      },
      {
        etiqueta: "p_v/γ",
        formula: `p_v(${fmt(datos.hid.temperaturaC, 0)} °C) / γ`,
        sustitucion: `${fmt(presionVaporKPa(datos.hid.temperaturaC), 3)} kPa / ${fmt(gamma, 3)} kN/m³`,
        valor: `${fmt(np.pvM, 3)} m`,
      },
      {
        etiqueta: "h_s (aspiración)",
        formula: "z_eje − z_agua",
        sustitucion: `${fmt(datos.cotaEjeBombaM, 2)} − ${fmt(nivelOp.cotaAguaM, 2)}`,
        valor: `${fmt(np.alturaAspiracionM, 3)} m`,
      },
      {
        etiqueta: `NPSHd (q = ${fmt(np.caudalBombaLs, 2)} L/s)`,
        formula: "p_atm/γ − p_v/γ − h_s − hf_succión",
        sustitucion: `${fmt(np.patmM, 3)} − ${fmt(np.pvM, 3)} − ${fmt(np.alturaAspiracionM, 3)} − ${fmt(np.hfSuccionM, 3)}`,
        valor: `${fmt(np.npshdM, 3)} m`,
      },
      {
        etiqueta: "Verificación NPSH",
        formula: "NPSHd ≥ NPSHr + margen",
        sustitucion: np.npshrM === null ? "sin NPSHr" : `${fmt(np.npshdM, 2)} ≥ ${fmt(np.npshrM, 2)} + ${fmt(datos.margenNpshM, 2)}`,
        valor: np.cumple === null ? "sin verificar" : np.cumple ? "verifica" : "NO verifica",
      }
    );
  }
  if (nivelOp?.sumergencia) {
    const s = nivelOp.sumergencia;
    filas.push({
      etiqueta: "Sumergencia S",
      formula: "z_agua − z_admisión ≥ S_mín",
      sustitucion: `${fmt(nivelOp.cotaAguaM, 2)} − ${fmt(datos.cotaAdmisionM, 2)} = ${fmt(s.disponibleM, 2)} ≥ ${fmt(s.requeridaM, 2)}`,
      valor: s.cumple ? "verifica" : "NO verifica",
    });
  }
  return filas;
}
