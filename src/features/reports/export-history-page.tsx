import { History } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function ExportHistoryPage() {
  return (
    <ModulePlaceholder
      moduleKey="exportHistory"
      icon={<History className="h-5 w-5" />}
    />
  );
}
