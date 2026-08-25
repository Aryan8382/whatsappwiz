import { LayoutGrid } from "lucide-react";
import ModulePlaceholder from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={LayoutGrid}
      title="Apps"
      description="Connect and manage third-party apps and integrations."
    />
  );
}
