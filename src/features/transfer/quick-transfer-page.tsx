import { Send } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function QuickTransferPage() {
  return (
    <ModulePlaceholder
      moduleKey="quickTransfer"
      icon={<Send className="h-5 w-5" />}
      safetyKey="safety.owned"
    />
  );
}
