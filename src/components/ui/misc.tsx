import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-line-soft text-fg-muted",
        success: "border border-success/40 bg-success/15 text-success",
        danger: "border border-danger/40 bg-danger/15 text-danger",
        warning: "border border-warning/40 bg-warning/15 text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-line-soft bg-surface text-fg",
      warning: "border-warning/50 bg-warning/10 text-fg",
      danger: "border-danger/50 bg-danger/10 text-fg",
      success: "border-success/50 bg-success/10 text-fg",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle2,
};

export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof alertVariants> & { title?: React.ReactNode }) {
  const Icon = icons[variant ?? "info"];
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-bold text-fg">{title}</p>}
        <div className="text-fg-muted [&_strong]:text-fg">{children}</div>
      </div>
    </div>
  );
}
