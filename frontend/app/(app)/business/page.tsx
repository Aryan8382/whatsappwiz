import { Briefcase } from "lucide-react";
import ModulePlaceholder from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Briefcase}
      title="Business"
      description="Manage your business profile and WhatsApp Business settings."
    />
  );
}
