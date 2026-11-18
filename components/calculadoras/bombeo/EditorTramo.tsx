"use client";

import { Copy, Trash2 } from "lucide-react";
import { CampoNumerico } from "@/components/calculadoras/comun/CampoNumerico";
import { CampoSeleccion } from "@/components/calculadoras/comun/CampoSeleccion";
import { ACCESORIOS } from "@/lib/calc/hidraulica/bombeo";
import { MATERIALES_TUBERIA } from "@/lib/calc/hidraulica/materiales";
import type { MetodoPerdidaCarga } from "@/lib/calc/hidraulica/perdida-carga";
import { aNumero, fmt } from "@/lib/calculadoras/formato";

/** Tramo tal como se edita en pantalla: todo texto, para no perder lo que se está tipeando. */
export interface TramoUI {
  id: string;
  nombre: string;
  materialId: string;
  /** Diámetro exterior (o nominal). */
  dn: string;
  /** Espesor de pared; 0 si `dn` ya es el diámetro interior. */
  espesor: string;
  longitud: string;
  rugosidad: string;
  hazenC: string;
  perdidaFija: string;
  porBomba: boolean;
  cantidades: Record<string, string>;
  kExtra: string;
}

export function diametroInteriorMm(t: TramoUI): number {
  return aNumero(t.dn) - 2 * (aNumero(t.espesor || "0") || 0);
}

export function sumaKTramo(t: TramoUI, kCatalogo: Record<string, number>): number {
  let s = aNumero(t.kExtra || "0") || 0;
  for (const a of ACCESORIOS) {
    const n = aNumero(t.cantidades[a.id] || "0") || 0;
    s += n * (kCatalogo[a.id] ?? a.k);
  }
  return s;
}

function textoDe(n: number): string {
  return String(n).replace(".", ",");
}

interface EditorTramoProps {
  tramo: TramoUI;
  onChange: (t: TramoUI) => void;
  onQuitar?: () => void;
  onDuplicar?: () => void;
  metodo: MetodoPerdidaCarga;
  kCatalogo: Record<string, number>;
  /** Velocidad con el caudal de diseño, para mostrarla en el encabezado. */
  velocidadMs?: number;
  /** Muestra la opción "lleva el caudal de una bomba". */
  mostrarPorBomba?: boolean;
  /** Accesorios que no tienen sentido en este tramo (p. ej. válvula de pie en la impulsión). */
  ocultar?: string[];
}

export function EditorTramo({
  tramo,
  onChange,
  onQuitar,
  onDuplicar,
  metodo,
  kCatalogo,
  velocidadMs,
  mostrarPorBomba = true,
  ocultar = [],
}: EditorTramoProps) {
  const set = <K extends keyof TramoUI>(k: K, v: TramoUI[K]) => onChange({ ...tramo, [k]: v });
  const material = MATERIALES_TUBERIA.find((m) => m.id === tramo.materialId) ?? MATERIALES_TUBERIA[0];
  const dInt = diametroInteriorMm(tramo);
  const sumaK = sumaKTramo(tramo, kCatalogo);
  const pre = `tramo-${tramo.id}`;

  return (
    <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Nombre del tramo"
          value={tramo.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 text-sm font-medium outline-none hover:border-input focus:border-ring focus:bg-background"
        />
        {velocidadMs !== undefined && Number.isFinite(velocidadMs) && (
          <span
            className={`shrink-0 font-mono text-[11px] tabular-nums ${velocidadMs > 0 && (velocidadMs < 0.6 || velocidadMs > 2.5) ? "font-semibold text-destructive" : "text-muted-foreground"}`}
          >
            V = {fmt(velocidadMs, 2)} m/s
          </span>
        )}
        {onDuplicar && (
          <button
            type="button"
            onClick={onDuplicar}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground print:hidden"
            aria-label={`Duplicar ${tramo.nombre}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {onQuitar && (
          <button
            type="button"
            onClick={onQuitar}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive print:hidden"
            aria-label={`Quitar ${tramo.nombre}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <CampoSeleccion
        id={`${pre}-material`}
        etiqueta="Material"
        valor={material.nombre}
        opciones={MATERIALES_TUBERIA.map((m) => m.nombre)}
        onChange={(nombre) => {
          const m = MATERIALES_TUBERIA.find((x) => x.nombre === nombre);
          if (m) onChange({ ...tramo, materialId: m.id, rugosidad: textoDe(m.rugosidadMm), hazenC: textoDe(m.hazenC) });
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <CampoNumerico id={`${pre}-dn`} etiqueta="Diám. exterior" sufijo="mm" valor={tramo.dn} onChange={(v) => set("dn", v)} />
        <CampoNumerico id={`${pre}-e`} etiqueta="Espesor" sufijo="mm" valor={tramo.espesor} onChange={(v) => set("espesor", v)} />
        <CampoNumerico id={`${pre}-l`} etiqueta="Longitud" sufijo="m" valor={tramo.longitud} onChange={(v) => set("longitud", v)} />
        {metodo === "darcy-weisbach" ? (
          <CampoNumerico id={`${pre}-eps`} etiqueta="Rugosidad ε" sufijo="mm" valor={tramo.rugosidad} onChange={(v) => set("rugosidad", v)} />
        ) : (
          <CampoNumerico id={`${pre}-c`} etiqueta="Coeficiente C" valor={tramo.hazenC} onChange={(v) => set("hazenC", v)} />
        )}
        <CampoNumerico
          id={`${pre}-fija`}
          etiqueta="Pérdida fija"
          sufijo="m"
          valor={tramo.perdidaFija}
          onChange={(v) => set("perdidaFija", v)}
        />
        <div className="flex items-end pb-1.5 text-xs text-muted-foreground">
          D interior = <span className="ml-1 font-mono tabular-nums text-foreground">{fmt(dInt, 1)} mm</span>
        </div>
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">
        Espesor 0 si el diámetro cargado ya es el interior. Pérdida fija: caudalímetro, filtro u otro equipo, con el caudal de
        diseño.
      </p>

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          Accesorios · Σ K = <span className="font-mono tabular-nums text-foreground">{fmt(sumaK, 2)}</span>
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {ACCESORIOS.filter((a) => !ocultar.includes(a.id)).map((a) => (
            <label key={a.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {a.nombre} <span className="font-mono">(K {fmt(kCatalogo[a.id] ?? a.k, 2)})</span>
              </span>
              <input
                inputMode="numeric"
                aria-label={`Cantidad de ${a.nombre} en ${tramo.nombre}`}
                value={tramo.cantidades[a.id] ?? ""}
                placeholder="0"
                onChange={(e) => set("cantidades", { ...tramo.cantidades, [a.id]: e.target.value })}
                className="h-7 w-14 rounded-sm border border-input bg-background px-1.5 text-right font-mono text-[13px] tabular-nums outline-none focus:border-ring"
              />
            </label>
          ))}
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">K adicional</span>
            <input
              inputMode="decimal"
              aria-label={`K adicional en ${tramo.nombre}`}
              value={tramo.kExtra}
              placeholder="0"
              onChange={(e) => set("kExtra", e.target.value)}
              className="h-7 w-14 rounded-sm border border-input bg-background px-1.5 text-right font-mono text-[13px] tabular-nums outline-none focus:border-ring"
            />
          </label>
        </div>
      </details>

      {mostrarPorBomba && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={tramo.porBomba} onChange={(e) => set("porBomba", e.target.checked)} />
          Lleva el caudal de una sola bomba (colector propio de cada bomba)
        </label>
      )}
    </fieldset>
  );
}
