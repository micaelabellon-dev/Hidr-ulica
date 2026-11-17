import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CampoNumericoProps {
  id: string;
  etiqueta: string;
  sufijo?: string;
  valor: string;
  onChange: (valor: string) => void;
  advertencia?: string;
}

export function CampoNumerico({ id, etiqueta, sufijo, valor, onChange, advertencia }: CampoNumericoProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {etiqueta} {sufijo && <span className="text-muted-foreground">({sufijo})</span>}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={advertencia ? `${id}-aviso` : undefined}
      />
      {advertencia && (
        <p id={`${id}-aviso`} className="text-xs text-muted-foreground">
          {advertencia}
        </p>
      )}
    </div>
  );
}
