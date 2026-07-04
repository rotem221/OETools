import { FolderTree } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function FileBrowserPage() {
  return (
    <ModulePlaceholder
      moduleKey="fileBrowser"
      icon={<FolderTree className="h-5 w-5" />}
      safetyKey="safety.owned"
    />
  );
}
