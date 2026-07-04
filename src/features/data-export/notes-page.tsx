import { NotebookPen } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function NotesPage() {
  return (
    <ModulePlaceholder
      moduleKey="notes"
      icon={<NotebookPen className="h-5 w-5" />}
      safetyKey="safety.encryptedPassword"
    />
  );
}
