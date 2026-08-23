import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bulk-discounts?productId=1&variantId=2
 *
 * Returns available bulk discount tiers for a product/variant.
 * Public endpoint — no auth required.
 *
 * Only returns active discounts within their time window.
 */

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const productId = Number(params.get("productId"));
        const variantId = params.get("variantId") ? Number(params.get("variantId")) : null;

        if (!productId || !Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json(
                { success: false, message: "Product ID tidak valid." },
                { status: 400 }
            );
        }

        const now = new Date();

        const where: any = {
            productId,
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        };

        if (variantId && Number.isInteger(variantId) && variantId > 0) {
            where.OR = [
                { variantId },
                { variantId: null },
            ];
        } else {
            where.variantId = null;
        }

        const tiers = await prisma.bulkDiscount.findMany({
            where,
            orderBy: { minQuantity: "asc" },
            select: {
                id: true,
                name: true,
                minQuantity: true,
                type: true,
                value: true,
                maxDiscount: true,
                startAt: true,
                endAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: tiers.map((t) => ({
                id: t.id,
                name: t.name,
                minQuantity: t.minQuantity,
                type: t.type,
                value: Number(t.value),
                maxDiscount: t.maxDiscount ? Number(t.maxDiscount) : null,
                startAt: t.startAt.toISOString(),
                endAt: t.endAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("GET /api/bulk-discounts ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data bulk discount." },
            { status: 500 }
        );
    }
}
