/**
 * Tablas que entran y salen de las calculadoras: leer un CSV o un Excel,
 * reconocer las columnas por nombre aunque vengan con tildes, mayúsculas o
 * unidades, y escribir los resultados de vuelta a CSV o Excel.
 *
 * Todo corre en el navegador: el archivo no sale de la máquina del usuario.
 * La lectura de Excel carga exceljs recién cuando hace falta, para no sumarle
 * ese peso a las páginas que no lo usan.
 */

export type Celda = string | number | boolean | Date | null | undefined;

export interface EspecColumna {
  /** Clave interna, en el orden en que la calculadora guarda la tabla. */
  clave: string;
  /** Nombre canónico, el que lleva la plantilla. */
  nombre: string;
  /** Otras formas aceptadas del encabezado, ya normalizadas (sin tildes, minúsculas). */
  alias: readonly string[];
  obligatoria: boolean;
  tipo: "numero" | "fecha";
}

/** "Precipitación (mm)" → "precipitacion_mm". */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function coincide(normalizado: string, espec: EspecColumna): boolean {
  const candidatos = [espec.nombre, ...espec.alias];
  return candidatos.some((c) => normalizado === c || normalizado.startsWith(`${c}_`));
}

export interface ResultadoImportacion {
  /** Filas en el orden de las especificaciones, como texto editable. */
  celdas: string[][];
  /** Número de fila del archivo de cada fila de `celdas` (1 = encabezado). */
  filasArchivo: number[];
  /** Encabezado normalizado de cada columna encontrada, por clave (para leer unidades). */
  encabezados: Record<string, string>;
  errores: string[];
}

/** Hasta qué fila se busca el encabezado (puede haber títulos o notas arriba). */
const FILAS_BUSQUEDA_ENCABEZADO = 30;

function ubicarColumnas(encabezados: string[], especs: readonly EspecColumna[]) {
  const indices = new Map<string, number>();
  const usados = new Set<number>();
  for (const espec of especs) {
    const i = encabezados.findIndex((e, j) => !usados.has(j) && e !== "" && coincide(normalizarEncabezado(e), espec));
    if (i >= 0) {
      indices.set(espec.clave, i);
      usados.add(i);
    }
  }
  return { indices, usados };
}

/** Fila de unidades bajo el encabezado: tiene texto y ningún número ni fecha. */
function esFilaDeUnidades(fila: Celda[] | undefined): boolean {
  if (!fila) return false;
  const llenas = fila.filter((c) => textoCelda(c) !== "");
  return (
    llenas.length > 0 &&
    llenas.every((c) => typeof c === "string" && numeroDeCelda(c) !== null && Number.isNaN(numeroDeCelda(c)) && !fechaDeCelda(c))
  );
}

/**
 * Ubica las columnas por su encabezado y devuelve la tabla en el orden que
 * espera la calculadora. El encabezado es la fila, entre las primeras 30, que
 * reúne más columnas reconocidas (arriba puede haber un título). Si debajo hay
 * una fila de unidades («m³», «mm»), se suma al encabezado para leer la unidad
 * y no se toma como dato.
 */
export function importarTabla(crudo: Celda[][], especs: readonly EspecColumna[]): ResultadoImportacion {
  const errores: string[] = [];
  const primera = crudo.findIndex((fila) => fila.some((c) => textoCelda(c) !== ""));
  if (primera < 0) return { celdas: [], filasArchivo: [], encabezados: {}, errores: ["El archivo está vacío."] };

  const obligatorias = especs.filter((e) => e.obligatoria);
  let inicio = primera;
  let mejor = -1;
  for (let f = primera; f < Math.min(crudo.length, primera + FILAS_BUSQUEDA_ENCABEZADO); f++) {
    const { indices } = ubicarColumnas(crudo[f].map((c) => textoCelda(c)), especs);
    const puntaje = obligatorias.filter((e) => indices.has(e.clave)).length * 100 + indices.size;
    if (puntaje > mejor) {
      mejor = puntaje;
      inicio = f;
    }
    if (obligatorias.every((e) => indices.has(e.clave))) break;
  }

  const encabezados = crudo[inicio].map((c) => textoCelda(c));
  const { indices, usados } = ubicarColumnas(encabezados, especs);

  const faltantes = obligatorias.filter((e) => !indices.has(e.clave));
  if (faltantes.length > 0) {
    const sobrantes = encabezados.filter((e, j) => e !== "" && !usados.has(j));
    errores.push(
      `Falta${faltantes.length > 1 ? "n las columnas" : " la columna"} ${faltantes.map((f) => `«${f.nombre}»`).join(", ")}.`
    );
    errores.push(`Los encabezados esperados son: ${especs.map((e) => `«${e.nombre}»`).join(", ")}.`);
    if (sobrantes.length > 0) {
      errores.push(`No se reconocieron estas columnas del archivo: ${sobrantes.map((s) => `«${s}»`).join(", ")}.`);
    }
    return { celdas: [], filasArchivo: [], encabezados: {}, errores };
  }

  let datosDesde = inicio + 1;
  const unidades = esFilaDeUnidades(crudo[datosDesde]) ? crudo[datosDesde].map((c) => textoCelda(c)) : null;
  if (unidades) datosDesde++;

  const encabezadosEncontrados: Record<string, string> = {};
  for (const [clave, i] of indices) {
    const u = unidades?.[i] ?? "";
    encabezadosEncontrados[clave] = normalizarEncabezado(u ? `${encabezados[i]} ${u}` : encabezados[i]);
  }

  const celdas: string[][] = [];
  const filasArchivo: number[] = [];
  for (let f = datosDesde; f < crudo.length; f++) {
    const fila = crudo[f] ?? [];
    const valores = especs.map((e) => {
      const i = indices.get(e.clave);
      if (i === undefined) return "";
      const c = fila[i];
      return e.tipo === "fecha" ? textoFecha(c) : textoNumero(c);
    });
    if (valores.every((v) => v === "")) continue;
    celdas.push(valores);
    filasArchivo.push(f + 1);
  }
  if (celdas.length === 0) errores.push("El archivo tiene encabezados pero ninguna fila de datos.");
  return { celdas, filasArchivo, encabezados: encabezadosEncontrados, errores };
}

export interface HojaLeida {
  nombre: string;
  filas: Celda[][];
}

/**
 * Prueba cada hoja del libro y se queda con la primera que tiene todas las
 * columnas obligatorias. Si ninguna las tiene, informa los errores de la que
 * más se acercó.
 */
export function importarLibro(
  hojas: readonly HojaLeida[],
  especs: readonly EspecColumna[]
): ResultadoImportacion & { hoja: string } {
  let mejor: (ResultadoImportacion & { hoja: string }) | null = null;
  for (const h of hojas) {
    const r = { ...importarTabla(h.filas, especs), hoja: h.nombre };
    if (r.errores.length === 0) return r;
    if (!mejor || r.errores.length < mejor.errores.length) mejor = r;
  }
  if (!mejor) return { celdas: [], filasArchivo: [], encabezados: {}, errores: ["El archivo está vacío."], hoja: "" };
  if (hojas.length > 1) {
    mejor.errores = [
      `Ninguna de las ${hojas.length} hojas (${hojas.map((h) => `«${h.nombre}»`).join(", ")}) tiene todas las columnas.`,
      ...mejor.errores.map((e) => `Hoja «${mejor!.hoja}»: ${e}`),
    ];
  }
  return mejor;
}

function textoCelda(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return isoDeFecha(c);
  return String(c).trim();
}

function textoNumero(c: Celda): string {
  // 12 cifras significativas: saca el ruido de coma flotante (160,90000000000003) sin perder precisión útil.
  if (typeof c === "number") return String(+c.toPrecision(12)).replace(".", ",");
  return textoCelda(c);
}

function textoFecha(c: Celda): string {
  if (c instanceof Date) return isoDeFecha(c);
  // Excel guarda las fechas como días desde 1899-12-30 cuando la celda no tiene formato de fecha.
  if (typeof c === "number" && c > 1000 && c < 100000) {
    return isoDeFecha(new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86_400_000));
  }
  return textoCelda(c);
}

function isoDeFecha(d: Date): string {
  const a = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

/**
 * Número escrito a mano o leído de un CSV. Acepta coma o punto decimal; si
 * aparecen los dos, el último es el decimal y el otro separa miles.
 * Devuelve null si la celda está vacía y NaN si no es un número.
 */
export function numeroDeCelda(texto: string): number | null {
  let t = texto.trim().replace(/\s/g, "");
  if (t === "") return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma >= 0) {
    t = t.replace(",", ".");
  }
  t = t.replace(/^−/, "-");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Fecha escrita en cualquiera de las formas habituales: 2024-01-15, 2024-01,
 * 15/01/2024, 01/2024, ene-2024. Devuelve año, mes y día (día 1 si no viene),
 * o null si no se puede interpretar.
 */
export function fechaDeCelda(texto: string): { anio: number; mes: number; dia: number } | null {
  const t = texto.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  let anio: number, mes: number, dia = 1;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[t\s].*)?$/))) {
    anio = +m[1]; mes = +m[2]; dia = m[3] ? +m[3] : 1;
  } else if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    dia = +m[1]; mes = +m[2]; anio = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  } else if ((m = t.match(/^(\d{1,2})[-/.](\d{4})$/))) {
    mes = +m[1]; anio = +m[2];
  } else if ((m = t.match(/^([a-z]{3})[a-z]*[-/.\s]+(\d{2}|\d{4})$/)) && MESES[m[1]]) {
    mes = MESES[m[1]]; anio = +m[2] < 100 ? 2000 + +m[2] : +m[2];
  } else {
    return null;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return { anio, mes, dia };
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// ── Lectura de archivos ────────────────────────────────────────────────────

/** Separa un CSV, detectando si el separador es punto y coma, tabulación o coma. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const cuenta = (s: string) => primera.split(s).length - 1;
  const sep = cuenta(";") > 0 ? ";" : cuenta("\t") > 0 ? "\t" : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (entreComillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') {
        entreComillas = false;
      } else {
        campo += ch;
      }
    } else if (ch === '"') {
      entreComillas = true;
    } else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += ch;
    }
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** Lee todas las hojas de un .xlsx, o un .csv/.txt como una sola hoja. */
export async function leerArchivoTabla(archivo: File): Promise<HojaLeida[]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    return [{ nombre: archivo.name, filas: parsearCsv(await archivo.text()) }];
  }
  if (nombre.endsWith(".xls")) {
    throw new Error("El formato .xls (Excel 97-2003) no se puede leer. Guardalo como .xlsx o .csv y volvé a cargarlo.");
  }
  if (!nombre.endsWith(".xlsx") && !nombre.endsWith(".xlsm")) {
    throw new Error("El archivo tiene que ser .xlsx o .csv.");
  }
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  if (libro.worksheets.length === 0) throw new Error("El Excel no tiene ninguna hoja.");
  return libro.worksheets.map((hoja) => {
    const filas: Celda[][] = [];
    hoja.eachRow({ includeEmpty: true }, (fila, n) => {
      const valores: Celda[] = [];
      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        valores[col - 1] = valorCeldaExcel(celda.value);
      });
      filas[n - 1] = valores;
    });
    return { nombre: hoja.name, filas: Array.from(filas, (f) => f ?? []) };
  });
}

function valorCeldaExcel(v: unknown): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Fórmula: se usa el valor calculado; sin valor guardado (p. ej. una fórmula que da ""), queda vacía.
    if ("formula" in o || "sharedFormula" in o || "result" in o) return valorCeldaExcel(o.result);
    if ("error" in o) return String(o.error);
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((r) => r.text).join("");
    }
    if ("text" in o) return String(o.text);
  }
  return String(v);
}

// ── Escritura de archivos ──────────────────────────────────────────────────

export interface TablaSalida {
  hoja: string;
  encabezados: string[];
  filas: (string | number | Date | null)[][];
  /** Formato numérico de Excel por columna, p. ej. "0.000" o "yyyy-mm-dd". */
  formatos?: (string | undefined)[];
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV con punto y coma y coma decimal, que es como lo abre Excel en castellano. */
export function generarCsv(tabla: TablaSalida): string {
  const escapar = (v: string | number | Date | null) => {
    const s =
      v === null ? "" : v instanceof Date ? isoDeFecha(v) : typeof v === "number" ? String(+v.toFixed(6)).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [tabla.encabezados, ...tabla.filas].map((f) => f.map(escapar).join(";")).join("\r\n");
}

export function descargarCsv(tabla: TablaSalida, nombre: string) {
  descargar(new Blob(["﻿" + generarCsv(tabla)], { type: "text/csv;charset=utf-8" }), nombre);
}

export async function descargarXlsx(tablas: TablaSalida[], nombre: string) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "HidroCalc";
  for (const t of tablas) {
    const hoja = libro.addWorksheet(t.hoja);
    hoja.addRow(t.encabezados).font = { bold: true };
    for (const f of t.filas) hoja.addRow(f);
    t.encabezados.forEach((e, i) => {
      const col = hoja.getColumn(i + 1);
      col.width = Math.max(12, e.length + 2);
      const formato = t.formatos?.[i];
      if (formato) col.numFmt = formato;
    });
    hoja.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await libro.xlsx.writeBuffer();
  descargar(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    nombre
  );
}
