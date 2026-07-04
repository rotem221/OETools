import { Contact } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export function ContactsPage() {
  return (
    <ModulePlaceholder
      moduleKey="contacts"
      icon={<Contact className="h-5 w-5" />}
      safetyKey="safety.encryptedPassword"
    />
  );
}
