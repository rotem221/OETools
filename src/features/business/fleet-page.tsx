import { LayoutGrid } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function FleetPage() {
  return (
    <ModulePlaceholder
      moduleKey="fleet"
      icon={<LayoutGrid className="h-5 w-5" />}
      safetyKey="safety.owned"
    />
  );
}
