"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { agruparPorCategoria, registroCalculadoras } from "@/lib/calculadoras/registry";

interface NavCalculadorasProps {
  onNavegar?: () => void;
}

export function NavCalculadoras({ onNavegar }: NavCalculadorasProps) {
  const pathname = usePathname();
  const categorias = agruparPorCategoria(registroCalculadoras);

  return (
    <nav className="space-y-6">
      <Link
        href="/calculadoras"
        onClick={onNavegar}
        className="block px-2 text-sm font-medium tracking-tight text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground"
      >
        ← Calculadoras
      </Link>
      {categorias.map(([categoria, items]) => (
        <div key={categoria} className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            {categoria}
          </p>
          {items.map((item) => {
            const activo = pathname === item.ruta;
            return (
              <Link
                key={item.id}
                href={item.ruta}
                onClick={onNavegar}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  activo
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {item.nombre}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
