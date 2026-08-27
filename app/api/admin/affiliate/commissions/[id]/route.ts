import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { transitionCommission } from "@/lib/affiliate/commission";
import { createAuditLog } from "@/lib/admin/audit-log";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/* ==========================================
 * PATCH /api/admin/affiliate/commissions/[id]
 * ==========================================
 *
 * Admin action on a single commission:
 *   - action: "APPROVE" (PENDING → APPROVED)
 *   - action: "CANCEL" (PENDING/APPROVED → CANCELLED)
 *   - action: "PAID" (APPROVED → PAID)
 *
 * All transitions validated server-side.
 */

export async function PATCH(req: Request, { params }: RouteContext) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const { id } = await params;
        const conversionId = Number(id);
        if (!Number.isInteger(conversionId) || conversionId <= 0) {
            return NextResponse.json({ success: false, message: "ID tidak valid." }, { status: 400 });
        }

        const body = await req.json();
        const { action, reason } = body;

        const statusMap: Record<string, string> = {
            APPROVE: "APPROVED",
            CANCEL: "CANCELLED",
            PAID: "PAID",
        };

        const newStatus = statusMap[action];
        if (!newStatus) {
            return NextResponse.json({ success: false, message: "Action tidak valid. Gunakan APPROVE, CANCEL, atau PAID." }, { status: 400 });
        }

        // CANCEL requires reason
        if (action === "CANCEL" && (!reason || !String(reason).trim())) {
            return NextResponse.json({ success: false, message: "Alasan pembatalan wajib diisi." }, { status: 400 });
        }

        await transitionCommission(conversionId, newStatus, session.user.id, reason);

        const auditAction = newStatus === "APPROVED" ? "COMMISSION_APPROVED" : newStatus === "CANCELLED" ? "COMMISSION_CANCELLED" : "COMMISSION_PAID";
        await createAuditLog({
            adminId: session.user.id,
            action: auditAction,
            entityType: "AffiliateConversion",
            entityId: conversionId,
            description: `Komisi diubah ke ${newStatus}${reason ? ` (${reason})` : ""}`,
            metadata: { newStatus, reason: reason || null },
        });

        return NextResponse.json({
            success: true,
            message: `Komisi berhasil diubah ke ${newStatus}.`,
        });
    } catch (error) {
        console.error("ADMIN COMMISSION ACTION ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memproses komisi." },
            { status: 500 }
        );
    }
}
