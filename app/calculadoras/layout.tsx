import { BarraMovil } from "@/components/calculadoras/comun/BarraMovil";
import { PieCalculadora } from "@/components/calculadoras/comun/PieCalculadora";

export default function CalculadorasLayout({ children }: LayoutProps<"/calculadoras">) {
  return (
    <div className="flex flex-1 flex-col">
      <BarraMovil />
      <div className="esquemas-acotados flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <PieCalculadora />
      </div>
    </div>
  );
}
