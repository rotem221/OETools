import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
