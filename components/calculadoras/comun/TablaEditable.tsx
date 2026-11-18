"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnaTabla {
  titulo: string;
  sufijo?: string;
  /** Texto de ejemplo para la celda vacía. */
  ejemplo?: string;
  /** Columna de texto libre (fechas); las demás abren el teclado numérico en el celular. */
  texto?: boolean;
}

interface TablaEditableProps {
  id: string;
  columnas: readonly ColumnaTabla[];
  filas: string[][];
  onChange: (filas: string[][]) => void;
  /** Números de fila (1 = primera) que tienen algún error, para marcarlas. */
  filasConError?: ReadonlySet<number>;
  porPagina?: number;
  /** Fila nueva que se agrega al final; por defecto, vacía. */
  filaNueva?: (filas: string[][]) => string[];
  /** Índice en la fila de cada columna mostrada, cuando se muestran sólo algunas. */
  indices?: readonly number[];
}

const celdaBase =
  "h-7 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-1.5 font-mono text-[13px] tabular-nums outline-none transition-colors hover:border-input focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30";

/**
 * Tabla de datos editable a mano. Se puede pegar un bloque copiado de Excel
 * (columnas separadas por tabulación): se reparte desde la celda donde se pega
 * hacia la derecha y hacia abajo, agregando filas si hace falta.
 */
export function TablaEditable({
  id,
  columnas,
  filas,
  onChange,
  filasConError,
  porPagina = 25,
  filaNueva,
  indices,
}: TablaEditableProps) {
  const ix = (c: number) => indices?.[c] ?? c;
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const paginaActual = Math.min(pagina, paginas - 1);
  const desde = paginaActual * porPagina;
  const visibles = filas.slice(desde, desde + porPagina);

  const cambiarCelda = (f: number, c: number, valor: string) => {
    const nuevas = filas.map((fila) => [...fila]);
    nuevas[f][ix(c)] = valor;
    onChange(nuevas);
  };

  const pegar = (f: number, c: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(texto.trim())) return; // un solo valor: pegado normal
    e.preventDefault();
    const bloque = texto
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((l) => l.split("\t"));
    const nuevas = filas.map((fila) => [...fila]);
    bloque.forEach((valores, i) => {
      const fi = f + i;
      while (nuevas.length <= fi) nuevas.push(filaNueva ? filaNueva(nuevas) : columnas.map(() => ""));
      valores.forEach((v, j) => {
        if (c + j < columnas.length) nuevas[fi][ix(c + j)] = v.trim();
      });
    });
    onChange(nuevas);
  };

  const agregar = () => {
    const nueva = filaNueva ? filaNueva(filas) : columnas.map(() => "");
    onChange([...filas, nueva]);
    setPagina(Math.floor(filas.length / porPagina));
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full border-collapse text-sm" aria-describedby={`${id}-ayuda`}>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th scope="col" className="w-9 px-1.5 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                #
              </th>
              {columnas.map((col) => (
                <th key={col.titulo} scope="col" className="px-1.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground">
                  {col.titulo}
                  {col.sufijo && <span className="font-normal"> ({col.sufijo})</span>}
                </th>
              ))}
              <th scope="col" className="w-8">
                <span className="sr-only">Quitar fila</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila, i) => {
              const f = desde + i;
              const conError = filasConError?.has(f + 1);
              return (
                <tr
                  key={f}
                  className={cn("border-b border-border/40 last:border-0", conError && "bg-destructive/8")}
                >
                  <td
                    className={cn(
                      "px-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground",
                      conError && "font-semibold text-destructive"
                    )}
                  >
                    {f + 1}
                  </td>
                  {columnas.map((col, c) => (
                    <td key={col.titulo} className="px-0.5 py-0.5">
                      <input
                        type="text"
                        inputMode={col.texto ? "text" : "decimal"}
                        aria-label={`${col.titulo}, fila ${f + 1}`}
                        placeholder={col.ejemplo}
                        value={fila[ix(c)] ?? ""}
                        onChange={(e) => cambiarCelda(f, c, e.target.value)}
                        onPaste={(e) => pegar(f, c, e)}
                        className={celdaBase}
                      />
                    </td>
                  ))}
                  <td className="px-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => onChange(filas.filter((_, k) => k !== f))}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive print:hidden"
                      aria-label={`Quitar la fila ${f + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 2} className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Sin filas. Agregá una a mano o importá un archivo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          onClick={agregar}
          className="flex h-7 items-center gap-1 rounded-md border border-input px-2 text-xs transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar fila
        </button>
        <p id={`${id}-ayuda`} className="text-[11px] text-muted-foreground">
          Se puede pegar un bloque copiado de Excel.
        </p>
        {paginas > 1 && (
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setPagina(Math.max(0, paginaActual - 1))}
              disabled={paginaActual === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-input transition-colors hover:bg-secondary disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 font-mono tabular-nums text-muted-foreground">
              {desde + 1}–{Math.min(filas.length, desde + porPagina)} de {filas.length}
            </span>
            <button
              type="button"
              onClick={() => setPagina(Math.min(paginas - 1, paginaActual + 1))}
              disabled={paginaActual >= paginas - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-input transition-colors hover:bg-secondary disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Fila 12: …" → 12. Sirve para marcar en la tabla las filas que tienen errores. */
export function filasDeErrores(errores: readonly string[]): Set<number> {
  const s = new Set<number>();
  for (const e of errores) {
    const m = e.match(/^Fila (\d+)/);
    if (m) s.add(Number(m[1]));
  }
  return s;
}
