"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { TemaToggle } from "@/components/TemaToggle";

/**
 * Barra superior fija: translúcida con desenfoque, para no cortar en seco la
 * retícula de fondo al hacer scroll.
 */
export function BarraSuperior() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            HidroCalc
          </p>
          <p className="text-sm font-semibold">Calculadoras de hidráulica</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/calculadoras"
            className="hidden h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:flex"
          >
            <Search className="h-4 w-4" />
            Ver calculadoras
          </Link>
          <TemaToggle />
        </div>
        <nav className="flex w-full gap-1.5 overflow-x-auto md:hidden" aria-label="Secciones">
          {[
            ["Inicio", "/"],
            ["Calculadoras", "/calculadoras"],
            ["Recursos", "/recursos"],
          ].map(([nombre, ruta]) => (
            <Link
              key={ruta}
              href={ruta}
              className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {nombre}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
