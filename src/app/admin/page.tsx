import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Access is enforced by every /api/admin call; this shell only renders the UI. */
export default function AdminPage() {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <Suspense>
        <AdminApp />
      </Suspense>
    </div>
  );
}
