import { FileCog } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function ProfileEditorPage() {
  return (
    <ModulePlaceholder
      moduleKey="profileEditor"
      icon={<FileCog className="h-5 w-5" />}
      safetyKey="safety.supervisionWarning"
    />
  );
}
