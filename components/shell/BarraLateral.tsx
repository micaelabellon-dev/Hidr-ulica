"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, LayoutGrid, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavCalculadoras } from "@/components/calculadoras/comun/NavCalculadoras";

interface Destino {
  nombre: string;
  ruta: string;
  Icono: typeof LayoutGrid;
  prefijo?: boolean;
}

const DESTINOS: Destino[] = [
  { nombre: "Resumen", ruta: "/", Icono: LayoutGrid },
  { nombre: "Calculadoras", ruta: "/calculadoras", Icono: Calculator, prefijo: true },
];

export function BarraLateral() {
  const ruta = usePathname();
  const enCalculadora = ruta.startsWith("/calculadoras/");

  const estaActivo = (destino: Destino) =>
    destino.prefijo ? ruta.startsWith(destino.ruta) : ruta === destino.ruta;

  return (
    <aside className="hidden w-60 shrink-0 bg-sidebar text-sidebar-foreground md:block print:hidden">
      <div className="sticky top-0 flex h-screen flex-col gap-6 overflow-y-auto p-4">
        <Link href="/" className="block px-1 pt-1" aria-label="HidroCalc — inicio">
          <Logo className="h-7 w-auto text-sidebar-accent-foreground" titulo="" />
          <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Cálculo hidráulico
          </span>
        </Link>

        <nav className="flex flex-col gap-5">
          <div>
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Espacio de trabajo
            </p>
            <ul className="space-y-0.5">
              {DESTINOS.map((destino) => {
                const activo = estaActivo(destino);
                return (
                  <li key={destino.ruta}>
                    <Link
                      href={destino.ruta}
                      aria-current={activo ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        activo
                          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <destino.Icono className="h-4 w-4 shrink-0" />
                      {destino.nombre}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Dentro de una calculadora, la barra suma la lista completa: navegación contextual. */}
        {enCalculadora && (
          <div className="border-t border-sidebar-border pt-4">
            <NavCalculadoras />
          </div>
        )}

        <div className="mt-auto border-t border-sidebar-border pt-3">
          <Link
            href="/alcance"
            className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-sidebar-accent"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-medium text-sidebar-accent-foreground">Alcance y responsabilidad</span>
              <span className="block text-sidebar-foreground/60">Qué respalda cada número</span>
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
