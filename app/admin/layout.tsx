import { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import AdminNavbar from "@/components/admin/AdminNavbar";

export default async function AdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = (session.user as any).role;

    if (role !== "ADMIN") {
        redirect("/products");
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminNavbar />

            <main className="lg:pl-64">
                {children}
            </main>
        </div>
    );
}