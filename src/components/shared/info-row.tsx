import { CopyButton } from "./copy-button";

export function InfoRow({
  label,
  value,
  copyable = false,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  copyable?: boolean;
  mono?: boolean;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={`text-sm text-foreground truncate ${mono ? "font-mono text-xs" : ""}`}
          title={display}
          dir="ltr"
        >
          {display}
        </span>
        {copyable && display !== "—" && <CopyButton value={display} />}
      </div>
    </div>
  );
}
