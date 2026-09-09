import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateAndCalculateVoucherEnhanced, type VoucherValidationItem } from "@/lib/voucher";
import { rateLimiters, getClientIp } from "@/lib/rate-limit";

/*
 * ==========================================
 * POST /api/voucher/validate
 * ==========================================
 *
 * Dipakai di halaman checkout (buy-now maupun
 * keranjang) buat nge-preview berapa diskon
 * yang didapat SEBELUM order dibuat.
 *
 * PENTING: endpoint ini TIDAK mengunci kuota
 * voucher. Validasi ulang WAJIB dilakukan lagi
 * di dalam transaction pembuatan order (lihat
 * lib/voucher.ts).
 */
export async function POST(request: Request) {
    try {
        // Rate limiting
        const clientIp = getClientIp(request);
        const rateLimit = rateLimiters.voucherValidation(clientIp);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
                { status: 429 }
            );
        }

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const { code, subtotal } = body;

        if (typeof code !== "string" || !code.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Kode voucher wajib diisi.",
                },
                { status: 400 }
            );
        }

        const parsedSubtotal = Number(subtotal);

        if (!Number.isFinite(parsedSubtotal) || parsedSubtotal <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Subtotal tidak valid.",
                },
                { status: 400 }
            );
        }

        // Build minimal items array for eligibility check
        // (items parameter is optional for preview — eligibility still checked)
        const items: VoucherValidationItem[] = Array.isArray(body.items) ? body.items : [];

        /*
         * F10: Resolve the campaign context from the cart items so
         * campaign-scoped vouchers validate/preview correctly.
         * Mirrors the authoritative resolution in lib/checkout.ts.
         */
        let campaignId: number | null = null;
        try {
            const { resolveOrderCampaignId } = await import("@/lib/marketing/batch-pricing");
            const productIds = items
                .map((i) => Number(i.productId))
                .filter((id) => Number.isInteger(id) && id > 0);
            campaignId = productIds.length
                ? await resolveOrderCampaignId(
                      productIds.map((productId) => ({ productId }))
                  )
                : null;
        } catch {
            campaignId = null;
        }

        const result = await validateAndCalculateVoucherEnhanced(
            code,
            parsedSubtotal,
            items,
            session.user.id,
            campaignId,
            prisma
        );

        if (!result.valid) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.message,
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                code: result.voucher.code,
                type: result.voucher.type,
                discount: result.discount,
            },
        });
    } catch (error) {
        console.error("VOUCHER VALIDATE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memvalidasi voucher.",
            },
            { status: 500 }
        );
    }
}