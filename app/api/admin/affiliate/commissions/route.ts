import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/admin/affiliate/commissions
 * ==========================================
 *
 * Admin list of all affiliate conversions
 * with affiliate info and order details.
 *
 * Query params:
 *   - page, limit, status, affiliateId, search
 */

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const statusFilter = searchParams.get("status");
        const affiliateIdParam = searchParams.get("affiliateId");
        const search = searchParams.get("search")?.trim();

        const where: any = {};
        if (statusFilter && statusFilter !== "ALL") {
            where.status = statusFilter;
        }
        if (affiliateIdParam) {
            where.affiliateId = Number(affiliateIdParam);
        }
        if (search) {
            where.OR = [
                { affiliateCode: { contains: search } },
                { order: { orderNumber: { contains: search } } },
            ];
        }

        const [conversions, total] = await Promise.all([
            prisma.affiliateConversion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    affiliate: {
                        include: { user: { select: { name: true } } },
                    },
                    order: { select: { orderNumber: true, recipientName: true } },
                },
            }),
            prisma.affiliateConversion.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                items: conversions.map((c) => ({
                    id: c.id,
                    affiliateId: c.affiliateId,
                    affiliateName: c.affiliate.user?.name ?? "-",
                    affiliateCode: c.affiliateCode,
                    orderNumber: c.order.orderNumber,
                    customerName: c.order.recipientName,
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
        console.error("ADMIN COMMISSIONS LIST ERROR:", error);
        return NextResponse.json({ success: false, message: "Gagal mengambil data komisi." }, { status: 500 });
    }
}
