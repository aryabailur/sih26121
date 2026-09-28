import type { ReactNode } from "react";
import { CommandCenter } from "@/components/layout/CommandCenter";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <CommandCenter>{children}</CommandCenter>;
}
