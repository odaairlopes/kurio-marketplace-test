import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-input bg-ink px-3 text-sm text-fg placeholder:text-fg-muted/70 transition-colors focus-visible:border-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 aria-[invalid=true]:border-danger";

/** Campo dos frames mobile do Figma: 50 px, raio 10, borda #3F2319, placeholder #B39463. */
export const FIGMA_INPUT =
  "h-[50px] rounded-[10px] border-line bg-transparent px-4 text-[15px] placeholder:text-brand-secondary focus-visible:border-brand focus-visible:ring-0";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("flex h-11", base, className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-24 py-2", base, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("flex h-11 appearance-none bg-ink", base, className)}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";
