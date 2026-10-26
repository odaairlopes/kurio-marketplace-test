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
  /**
   * default: caixa com bordas (desktop) · pill: botões 20×30 da marca (detalhe
   * mobile) · circle: botões redondos 23 px (carrinho mobile).
   */
  variant?: "default" | "pill" | "circle";
}

const STYLES = {
  default: {
    root: "h-10 rounded-md border border-line-soft",
    button:
      "size-10 text-fg hover:text-accent-text disabled:opacity-40 [&_svg]:size-4",
    input:
      "h-full w-12 border-x border-line-soft text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring/40",
  },
  pill: {
    root: "h-[30px]",
    button:
      "h-[30px] w-5 rounded-full border border-ink bg-brand text-black shadow-[0_4px_12px_rgb(20_13_10/0.15)] hover:brightness-110 disabled:cursor-not-allowed [&_svg]:size-3",
    input:
      "h-full w-[35px] text-base text-fg focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm",
  },
  circle: {
    root: "h-[23px]",
    button:
      "size-[23px] rounded-full border border-line bg-surface-raised text-fg hover:border-line-soft disabled:text-line-soft [&_svg]:size-3.5",
    input:
      "h-full w-[34px] text-base text-fg focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm",
  },
} as const;

/** Controle de quantidade inteiro, limitado à disponibilidade. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  className,
  variant = "default",
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const style = STYLES[variant];
  return (
    <div
      className={cn("inline-flex items-center", style.root, className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center transition",
          style.button,
        )}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus strokeWidth={variant === "default" ? 2 : 2.5} aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className={cn(
          "bg-transparent text-center [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none",
          style.input,
        )}
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
        className={cn(
          "flex shrink-0 items-center justify-center transition",
          style.button,
        )}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus strokeWidth={variant === "default" ? 2 : 2.5} aria-hidden />
      </button>
    </div>
  );
}
