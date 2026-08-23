import { NextRequest, NextResponse } from "next/server";
import { calculateShippingDiscount } from "@/lib/marketing/shipping-discount";

/**
 * POST /api/shipping/discount-preview
 *
 * Preview shipping discount for a given shipping cost and subtotal.
 * Used by Checkout and Buy Now UIs to show discount before order creation.
 *
 * Body:
 *   shippingCost — number (server-verified shipping cost)
 *   subtotal     — number (order subtotal)
 *   code         — string | null (optional shipping discount code)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const shippingCost = Number(body.shippingCost);
        const subtotal = Number(body.subtotal);
        const code = typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;

        if (!Number.isFinite(shippingCost) || shippingCost < 0) {
            return NextResponse.json(
                { success: false, message: "Biaya pengiriman tidak valid." },
                { status: 400 }
            );
        }

        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return NextResponse.json(
                { success: false, message: "Subtotal tidak valid." },
                { status: 400 }
            );
        }

        const result = await calculateShippingDiscount(shippingCost, subtotal, code);

        if (!result) {
            return NextResponse.json({
                success: true,
                data: {
                    hasDiscount: false,
                    discountAmount: 0,
                    finalShippingCost: shippingCost,
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                hasDiscount: true,
                shippingDiscountId: result.shippingDiscountId,
                name: result.name,
                originalShippingCost: result.originalShippingCost,
                discountAmount: result.discountAmount,
                finalShippingCost: result.finalShippingCost,
            },
        });
    } catch (error) {
        console.error("SHIPPING DISCOUNT PREVIEW ERROR:", error);
        // Non-fatal — return no discount
        return NextResponse.json({
            success: true,
            data: {
                hasDiscount: false,
                discountAmount: 0,
                finalShippingCost: 0,
            },
        });
    }
}
