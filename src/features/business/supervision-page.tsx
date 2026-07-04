import { Building2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function SupervisionPage() {
  return (
    <ModulePlaceholder
      moduleKey="supervision"
      icon={<Building2 className="h-5 w-5" />}
      experimental
      safetyKey="safety.supervisionWarning"
    />
  );
}
