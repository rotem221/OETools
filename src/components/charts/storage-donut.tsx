import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatBytes } from "@/lib/utils";
import type { StorageInfo } from "@/lib/db-types";

export function StorageDonut({ storage }: { storage: StorageInfo }) {
  const used = storage.used_bytes ?? 0;
  const total = storage.total_bytes ?? 0;
  const free = storage.free_bytes ?? Math.max(total - used, 0);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  const data = [
    { name: "used", value: used },
    { name: "free", value: free },
  ];

  return (
    <div className="relative h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={58}
            outerRadius={74}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill="hsl(var(--primary))" />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{pct}%</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(used)}
        </span>
      </div>
    </div>
  );
}
