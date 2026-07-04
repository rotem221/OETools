import { PackageOpen } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function ExportAllPage() {
  return (
    <ModulePlaceholder
      moduleKey="exportAll"
      icon={<PackageOpen className="h-5 w-5" />}
      safetyKey="safety.owned"
    />
  );
}
