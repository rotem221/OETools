import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

const icons = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const accent = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  error: "text-destructive",
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = icons[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div className="pointer-events-auto flex w-80 items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-lg animate-slide-in-right">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", accent[toast.variant])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}
