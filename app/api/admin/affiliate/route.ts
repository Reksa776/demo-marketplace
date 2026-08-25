import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/admin/affiliate
 * ==========================================
 *
 * Admin list of all affiliates with
 * performance stats (clicks, orders, sales,
 * commission breakdown).
 *
 * Query params:
 *   - page, limit, status, search, sort
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
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const statusParam = searchParams.get("status");
        const search = searchParams.get("search")?.trim();
        const sort = searchParams.get("sort") || "createdAt";
        const daysParam = searchParams.get("days");
        const days = daysParam && daysParam !== "all" ? parseInt(daysParam) : null;

        // Build where
        const where: any = {};
        if (statusParam && statusParam !== "ALL") {
            where.status = statusParam;
        }
        if (search) {
            where.OR = [
                { affiliateCode: { contains: search } },
                { user: { name: { contains: search } } },
                { user: { email: { contains: search } } },
            ];
        }

        // Get all affiliate IDs first for stats
        const [allAffiliates, total] = await Promise.all([
            prisma.affiliateProfile.findMany({
                where,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: { name: true, email: true },
                    },
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.affiliateProfile.count({ where }),
        ]);

        const ids = allAffiliates.map((a) => a.id);

        // Date filter for period-based stats
        const dateFilter = days ? { createdAt: { gte: new Date(Date.now() - days * 86400000) } } : {};

        // Get stats for all affiliates in parallel
        const [
            clicksCounts,
            conversionCounts,
            salesAggs,
            pendingAgg,
            approvedAgg,
            paidAgg,
            totalConvCount,
        ] = await Promise.all([
            // Clicks per affiliate (period-filtered)
            prisma.affiliateClick.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, ...dateFilter },
                _count: true,
            }),
            // Conversions per affiliate (period-filtered)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, ...dateFilter },
                _count: true,
            }),
            // Sales per affiliate (period-filtered)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, ...dateFilter },
                _sum: { orderSubtotal: true },
            }),
            // Pending commission (all-time for balance)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, status: "PENDING" },
                _sum: { commissionAmount: true },
            }),
            // Approved commission (all-time for balance)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, status: "APPROVED" },
                _sum: { commissionAmount: true },
            }),
            // Paid commission (all-time for balance)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, status: "PAID" },
                _sum: { commissionAmount: true },
            }),
            // Total conversions count (for conversion rate)
            prisma.affiliateConversion.groupBy({
                by: ["affiliateId"],
                where: { affiliateId: { in: ids }, ...dateFilter, status: { in: ["APPROVED", "PAID"] } },
                _count: true,
            }),
        ]);

        // Build lookup maps
        const clicksMap = new Map(clicksCounts.map((r) => [r.affiliateId, r._count]));
        const convMap = new Map(conversionCounts.map((r) => [r.affiliateId, r._count]));
        const salesMap = new Map(salesAggs.map((r) => [r.affiliateId, Number(r._sum.orderSubtotal ?? 0)]));
        const pendingMap = new Map(pendingAgg.map((r) => [r.affiliateId, Number(r._sum.commissionAmount ?? 0)]));
        const approvedMap = new Map(approvedAgg.map((r) => [r.affiliateId, Number(r._sum.commissionAmount ?? 0)]));
        const paidMap = new Map(paidAgg.map((r) => [r.affiliateId, Number(r._sum.commissionAmount ?? 0)]));
        const totalConvMap = new Map(totalConvCount.map((r) => [r.affiliateId, r._count]));

        const data = allAffiliates.map((app) => {
            const id = app.id;
            const clicks = clicksMap.get(id) ?? 0;
            const orders = convMap.get(id) ?? 0;
            const sales = salesMap.get(id) ?? 0;
            const pending = pendingMap.get(id) ?? 0;
            const approved = approvedMap.get(id) ?? 0;
            const paid = paidMap.get(id) ?? 0;
            const totalCommission = pending + approved + paid;
            const totalConversions = totalConvMap.get(id) ?? 0;
            const conversionRate = clicks > 0 ? Number(((totalConversions / clicks) * 100).toFixed(2)) : 0;

            return {
                id: app.id,
                name: app.user?.name ?? "-",
                email: app.user?.email ?? "-",
                affiliateCode: app.affiliateCode,
                commissionRate: Number(app.commissionRate),
                status: app.status,
                clicks,
                orders,
                totalConversions,
                conversionRate,
                sales,
                totalCommission,
                pendingCommission: pending,
                approvedCommission: approved,
                paidCommission: paid,
                approvedAt: app.approvedAt?.toISOString() ?? null,
                createdAt: app.createdAt.toISOString(),
            };
        });

        // Sort by computed field if needed
        if (sort === "sales") {
            data.sort((a, b) => b.sales - a.sales);
        } else if (sort === "commission") {
            data.sort((a, b) => b.totalCommission - a.totalCommission);
        } else if (sort === "orders") {
            data.sort((a, b) => b.orders - a.orders);
        } else if (sort === "clicks") {
            data.sort((a, b) => b.clicks - a.clicks);
        } else if (sort === "conversion") {
            data.sort((a, b) => b.conversionRate - a.conversionRate);
        }

        return NextResponse.json({
            success: true,
            data: {
                items: data,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        console.error("ADMIN AFFILIATE LIST ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data affiliate." },
            { status: 500 }
        );
    }
}
