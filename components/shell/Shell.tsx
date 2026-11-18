"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BarraLateral } from "@/components/shell/BarraLateral";
import { BarraSuperior } from "@/components/shell/BarraSuperior";

/**
 * Marco de la aplicación: barra lateral a la izquierda y barra superior fija
 * arriba del contenido. En impresión desaparece entero, y en la pantalla de
 * acceso no se muestra.
 */
export function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  if (ruta === "/acceso") return <div className="flex min-h-full flex-1">{children}</div>;
  return (
    <div className="flex min-h-full flex-1">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
