import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Controle de quantidade inteiro, limitado à disponibilidade. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  className,
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center rounded-md border border-line-soft",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="flex size-10 items-center justify-center text-fg hover:text-accent-text disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="h-full w-12 border-x border-line-soft bg-transparent text-center text-sm font-bold [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-inner-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        aria-label={`${label} (máximo ${max})`}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isInteger(n)) onChange(clamp(n));
        }}
      />
      <button
        type="button"
        className="flex size-10 items-center justify-center text-fg hover:text-accent-text disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
