import { Boxes } from "lucide-react";
import ModulePlaceholder from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Boxes}
      title="Catalogue"
      description="Manage the product catalogue shown to your customers."
    />
  );
}
