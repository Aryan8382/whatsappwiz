import { SignalHigh } from "lucide-react";
import ModulePlaceholder from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={SignalHigh}
      title="SIM Card"
      description="Manage connected SIM cards and their messaging numbers."
    />
  );
}
