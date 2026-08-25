import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/affiliate/commissions
 * ==========================================
 *
 * Customer list of own commission conversions
 * with pagination and status filter.
 */

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }

        const affiliate = await prisma.affiliateProfile.findFirst({
            where: { userId: session.user.id, status: "APPROVED" },
            select: { id: true },
        });

        if (!affiliate) {
            return NextResponse.json({ success: false, message: "Akun Anda belum menjadi affiliator." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const statusFilter = searchParams.get("status");

        const where: any = { affiliateId: affiliate.id };
        if (statusFilter && ["PENDING", "APPROVED", "PAID", "CANCELLED"].includes(statusFilter)) {
            where.status = statusFilter;
        }

        const [conversions, total] = await Promise.all([
            prisma.affiliateConversion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    order: { select: { orderNumber: true } },
                },
            }),
            prisma.affiliateConversion.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                items: conversions.map((c) => ({
                    id: c.id,
                    orderNumber: c.order.orderNumber,
                    orderSubtotal: Number(c.orderSubtotal),
                    commissionRate: Number(c.commissionRate),
                    commissionAmount: Number(c.commissionAmount),
                    status: c.status,
                    createdAt: c.createdAt.toISOString(),
                })),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        console.error("AFFILIATE COMMISSIONS ERROR:", error);
        return NextResponse.json({ success: false, message: "Gagal mengambil data komisi." }, { status: 500 });
    }
}
