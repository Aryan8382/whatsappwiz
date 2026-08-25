import { ShoppingBag } from "lucide-react";
import ModulePlaceholder from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={ShoppingBag}
      title="Order Details"
      description="View and manage customer orders placed through WhatsApp."
    />
  );
}
