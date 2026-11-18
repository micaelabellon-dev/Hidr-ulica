import { describe, expect, it } from "vitest";
import { fechaDeCelda, importarTabla, numeroDeCelda, parsearCsv } from "@/lib/calculadoras/tablas";
import { COLUMNAS_SERIE } from "@/lib/calc/hidraulica/balance-embalse";

describe("numeroDeCelda", () => {
  it("acepta coma y punto decimal, y separador de miles", () => {
    expect(numeroDeCelda("3,5")).toBe(3.5);
    expect(numeroDeCelda("3.5")).toBe(3.5);
    expect(numeroDeCelda("1.234,5")).toBe(1234.5);
    expect(numeroDeCelda("1,234.5")).toBe(1234.5);
    expect(numeroDeCelda("")).toBeNull();
    expect(numeroDeCelda("abc")).toBeNaN();
  });
});

describe("fechaDeCelda", () => {
  it("reconoce los formatos habituales", () => {
    expect(fechaDeCelda("2024-03-15")).toEqual({ anio: 2024, mes: 3, dia: 15 });
    expect(fechaDeCelda("15/03/2024")).toEqual({ anio: 2024, mes: 3, dia: 15 });
    expect(fechaDeCelda("03/2024")).toEqual({ anio: 2024, mes: 3, dia: 1 });
    expect(fechaDeCelda("mar-2024")).toEqual({ anio: 2024, mes: 3, dia: 1 });
    expect(fechaDeCelda("31/02/2024")).toBeNull();
  });
});

describe("importarTabla", () => {
  it("reconoce encabezados con tildes, mayúsculas y unidades, en cualquier orden", () => {
    const csv = "Fecha;Extracción (m³/s);Aporte (m3/s);Evaporación (mm);Precipitación (mm)\n2024-01-01;1,5;3;120;80\n";
    const r = importarTabla(parsearCsv(csv), COLUMNAS_SERIE);
    expect(r.errores).toEqual([]);
    expect(r.celdas).toEqual([["2024-01-01", "3", "80", "120", "1,5"]]);
    expect(r.filasArchivo).toEqual([2]);
  });

  it("informa columnas faltantes y las que no reconoce", () => {
    const r = importarTabla([["fecha", "aporte", "lluvia", "evapo", "extraccion"]], COLUMNAS_SERIE);
    expect(r.errores[0]).toMatch(/Falta la columna «evaporacion_mm»/);
    expect(r.errores.join()).toMatch(/«evapo»/);
  });

  it("convierte fechas de Excel (Date y número de serie)", () => {
    const r = importarTabla(
      [["fecha", "aporte", "precipitacion", "evaporacion", "extraccion"], [new Date(Date.UTC(2024, 0, 1)), 1, 2, 3, 4], [45323, 1, 2, 3, 4]],
      COLUMNAS_SERIE
    );
    expect(r.celdas.map((c) => c[0])).toEqual(["2024-01-01", "2024-02-01"]);
  });
});
