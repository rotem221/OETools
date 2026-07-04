import { Scale } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function EvidenceExportPage() {
  return (
    <ModulePlaceholder
      moduleKey="evidenceExport"
      icon={<Scale className="h-5 w-5" />}
      safetyKey="safety.securityIndicators"
    />
  );
}
