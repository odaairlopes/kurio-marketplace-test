import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium text-fg", className)}
    {...props}
  />
));
Label.displayName = "Label";

export interface FieldControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Label e dica só para leitores de tela (campos com placeholder dos frames mobile). */
  hideLabel?: boolean;
  children: (props: FieldControlProps) => React.ReactNode;
}

/** Associa label, dica e mensagem de erro ao controle (aria-describedby / aria-invalid). */
export function Field({
  label,
  error,
  hint,
  className,
  hideLabel,
  children,
}: FieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })}
      {hint && (
        <p
          id={hintId}
          className={cn("text-xs text-fg-muted", hideLabel && "sr-only")}
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-xs text-danger">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
