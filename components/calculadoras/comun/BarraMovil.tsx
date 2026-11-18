"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { TemaToggle } from "@/components/TemaToggle";
import { NavCalculadoras } from "@/components/calculadoras/comun/NavCalculadoras";

/** Barra superior sólo para pantallas chicas: la navegación fija vive en la barra lateral. */
export function BarraMovil() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetTrigger
          aria-label="Abrir el índice de calculadoras"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:outline-none"
        >
          <Menu className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetTitle className="sr-only">Índice de calculadoras</SheetTitle>
          <Link href="/" onClick={() => setAbierto(false)} className="mb-6 block px-2" aria-label="HidroCalc — inicio">
            <Logo className="h-7 w-auto text-sidebar-accent-foreground" titulo="" />
          </Link>
          <div className="mb-6 flex gap-1.5 px-2">
            {[
              ["Inicio", "/"],
              ["Recursos", "/recursos"],
            ].map(([nombre, ruta]) => (
              <Link
                key={ruta}
                href={ruta}
                onClick={() => setAbierto(false)}
                className="rounded-full border border-sidebar-border px-3 py-1 text-xs transition-colors hover:bg-sidebar-accent"
              >
                {nombre}
              </Link>
            ))}
          </div>
          <NavCalculadoras onNavegar={() => setAbierto(false)} />
        </SheetContent>
      </Sheet>

      <Link href="/" aria-label="HidroCalc — inicio">
        <Logo className="h-7 w-auto text-sidebar-accent-foreground" titulo="" />
      </Link>

      <div className="ml-auto">
        <TemaToggle />
      </div>
    </header>
  );
}
