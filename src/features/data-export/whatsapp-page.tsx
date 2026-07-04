import { MessageCircle } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function WhatsAppPage() {
  return (
    <ModulePlaceholder
      moduleKey="whatsapp"
      icon={<MessageCircle className="h-5 w-5" />}
      experimental
      safetyKey="safety.encryptedPassword"
    />
  );
}
