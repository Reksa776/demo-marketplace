import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuditLogs } from "@/lib/admin/audit-log";

/* ==========================================
 * GET /api/admin/audit-log
 * ==========================================
 *
 * Admin-only endpoint for querying audit logs.
 *
 * Query params:
 *   - page, limit
 *   - entityType (AffiliateProfile, AffiliateConversion, etc.)
 *   - entityId
 *   - action
 *   - adminId
 */

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized." },
                { status: 401 }
            );
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const entityType = searchParams.get("entityType") || undefined;
        const entityId = searchParams.get("entityId") ? parseInt(searchParams.get("entityId")!) : undefined;
        const action = searchParams.get("action") || undefined;
        const adminId = searchParams.get("adminId") || undefined;

        const result = await getAuditLogs({
            page,
            limit,
            entityType,
            entityId,
            adminId,
            action,
        });

        return NextResponse.json({
            success: true,
            data: {
                items: result.items.map((item) => ({
                    id: item.id,
                    adminId: item.adminId,
                    action: item.action,
                    entityType: item.entityType,
                    entityId: item.entityId,
                    description: item.description,
                    metadata: item.metadata,
                    createdAt: item.createdAt.toISOString(),
                })),
                pagination: result.pagination,
            },
        });
    } catch (error) {
        console.error("ADMIN AUDIT LOG ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil audit log." },
            { status: 500 }
        );
    }
}
