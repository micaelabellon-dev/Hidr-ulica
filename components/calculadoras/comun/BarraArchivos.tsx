"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import {
  descargarCsv,
  descargarXlsx,
  importarLibro,
  leerArchivoTabla,
  type EspecColumna,
  type TablaSalida,
} from "@/lib/calculadoras/tablas";

export const botonArchivo =
  "flex h-7 items-center gap-1.5 rounded-md border border-input px-2 text-xs transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

interface BarraArchivosProps {
  id: string;
  especs: readonly EspecColumna[];
  /**
   * Se llama con la tabla ya ordenada según `especs` y los encabezados
   * normalizados. Puede devolver avisos (p. ej. unidades convertidas) o errores
   * que frenan la importación.
   */
  onImportar: (celdas: string[][], encabezados: Record<string, string>) => { avisos?: string[]; errores?: string[] } | void;
  /** Plantilla descargable: la primera tabla va también al CSV. */
  plantilla?: () => TablaSalida[];
  nombrePlantilla?: string;
}

/**
 * Importar una tabla desde .xlsx o .csv y bajar su plantilla. Los errores de
 * encabezado (columnas faltantes o con otro nombre) se muestran acá mismo y
 * frenan la importación; los de datos los muestra la calculadora debajo de la
 * tabla, porque también aparecen al editar a mano.
 */
export function BarraArchivos({ id, especs, onImportar, plantilla, nombrePlantilla = "plantilla" }: BarraArchivosProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; lineas: string[] } | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setLeyendo(true);
    setMensaje(null);
    try {
      const hojas = await leerArchivoTabla(archivo);
      const r = importarLibro(hojas, especs);
      if (r.errores.length > 0) {
        setMensaje({ tipo: "error", lineas: [`No se importó «${archivo.name}»:`, ...r.errores] });
      } else {
        const extra = onImportar(r.celdas, r.encabezados) ?? {};
        if (extra.errores?.length) {
          setMensaje({ tipo: "error", lineas: [`No se importó «${archivo.name}»:`, ...extra.errores] });
        } else {
          setMensaje({
            tipo: "ok",
            lineas: [
              `Se importaron ${r.celdas.length} filas de «${archivo.name}»${hojas.length > 1 ? `, hoja «${r.hoja}»` : ""}. Si hay errores en los datos, aparecen debajo con el número de fila de la tabla.`,
              ...(extra.avisos ?? []),
            ],
          });
        }
      }
    } catch (e) {
      setMensaje({
        tipo: "error",
        lineas: [`No se pudo leer «${archivo.name}».`, e instanceof Error ? e.message : String(e)],
      });
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={entrada}
          id={`${id}-archivo`}
          type="file"
          accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          onChange={(e) => alElegir(e.target.files?.[0])}
        />
        <button type="button" className={botonArchivo} onClick={() => entrada.current?.click()} disabled={leyendo}>
          <Upload className="h-3.5 w-3.5" />
          {leyendo ? "Leyendo…" : "Importar Excel o CSV"}
        </button>
        {plantilla && (
          <>
            <button
              type="button"
              className={botonArchivo}
              onClick={() => descargarXlsx(plantilla(), `${nombrePlantilla}.xlsx`)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Plantilla .xlsx
            </button>
            <button
              type="button"
              className={botonArchivo}
              onClick={() => descargarCsv(plantilla()[0], `${nombrePlantilla}.csv`)}
            >
              <Download className="h-3.5 w-3.5" />
              Plantilla .csv
            </button>
          </>
        )}
      </div>
      {mensaje && (
        <div
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={
            mensaje.tipo === "error"
              ? "rounded-md border border-destructive/40 bg-destructive/8 p-2.5 text-xs text-destructive"
              : "rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground"
          }
        >
          {mensaje.lineas.map((l, i) => (
            <p key={i} className={i === 0 && mensaje.tipo === "error" ? "font-semibold" : undefined}>
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lista de errores de una tabla, con encabezado. No muestra nada si no hay errores. */
export function ListaErrores({ titulo, errores }: { titulo: string; errores: readonly string[] }) {
  if (errores.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/8 p-2.5 text-xs text-destructive">
      <p className="font-semibold">{titulo}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {errores.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/** Avisos que no frenan el cálculo pero conviene mirar. */
export function ListaAvisos({ avisos }: { avisos: readonly string[] }) {
  if (avisos.length === 0) return null;
  return (
    <div role="status" className="rounded-md border border-mat-critico/40 bg-mat-critico/8 p-2.5 text-xs">
      <p className="font-semibold text-mat-critico">Atención</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
        {avisos.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
