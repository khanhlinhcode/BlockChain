import type { ReactNode } from "react";
import AdminAuthLayout from "@/components/admin/AdminAuthLayout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAuthLayout>{children}</AdminAuthLayout>;
}
