import { FileBadge } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function ProfilesPage() {
  return (
    <ModulePlaceholder
      moduleKey="profiles"
      icon={<FileBadge className="h-5 w-5" />}
      safetyKey="safety.supervisionWarning"
    />
  );
}
