import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateSpinRewardDiscount } from "@/lib/spin-wheel";
import { rateLimiters, getClientIp } from "@/lib/rate-limit";

/**
 * ==========================================
 * GET /api/vouchers/available
 * ==========================================
 *
 * Returns all vouchers and spin wheel rewards
 * available to the current user, with eligibility
 * info and calculated discount previews.
 *
 * Query params:
 *   subtotal (number) - required
 *   items (JSON array of { productId, category }) - optional
 *
 * Response:
 *   {
 *     vouchers: [...],
 *     spinWheelRewards: [...]
 *   }
 *
 * Server-side eligibility check for each voucher:
 * - isActive
 * - expiry
 * - global quota
 * - per-user usage
 * - minimum purchase
 * - product restrictions
 * - category restrictions
 * - campaign restrictions
 * - eligibility (NEW_USER / RETURNING_USER)
 */
export async function GET(request: NextRequest) {
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
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Parse query params
        const subtotalParam = request.nextUrl.searchParams.get("subtotal");
        const subtotal = subtotalParam ? Number(subtotalParam) : 0;

        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return NextResponse.json(
                { success: false, message: "Subtotal tidak valid." },
                { status: 400 }
            );
        }

        // Parse optional items for product/category restriction check
        const itemsParam = request.nextUrl.searchParams.get("items");
        let items: Array<{ productId: number; category?: string | null }> = [];
        if (itemsParam) {
            try {
                items = JSON.parse(itemsParam);
            } catch {
                // ignore parse error
            }
        }

        const now = new Date();

        // ==========================================
        // 1. FETCH ACTIVE VOUCHERS
        // ==========================================

        const allVouchers = await prisma.voucher.findMany({
            where: { isActive: true },
            include: {
                productRestrictions: true,
                categoryRestrictions: true,
            },
            orderBy: [{ type: "desc" }, { value: "desc" }],
        });

        // ==========================================
        // 2. FETCH USER VOUCHER USAGE
        // ==========================================

        const userUsageRecords = await prisma.voucherUserUsage.findMany({
            where: { userId },
            select: { voucherId: true, usageCount: true },
        });

        const userUsageMap = new Map(
            userUsageRecords.map((r) => [r.voucherId, r.usageCount])
        );

        // ==========================================
        // 3. COMPUTE PAID ORDER COUNT (for eligibility)
        // ==========================================

        const paidOrderCount = await prisma.order.count({
            where: {
                userId,
                status: { in: ["PAID", "PROCESSING", "SHIPPED", "COMPLETED"] },
                paymentStatus: "PAID",
            },
        });

        // ==========================================
        // 4. VALIDATE VOUCHERS
        // ==========================================

        // Pre-fetch campaigns for vouchers that have campaignId
        const campaignIds = [...new Set(allVouchers.filter((v) => v.campaignId).map((v) => v.campaignId!))];
        const campaigns = campaignIds.length > 0
            ? await prisma.campaign.findMany({ where: { id: { in: campaignIds } } })
            : [];
        const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

        const vouchers: any[] = [];

        for (const v of allVouchers) {
            const result: any = {
                id: v.id,
                type: "REGULAR_VOUCHER" as const,
                title: v.description || v.code,
                code: v.code,
                voucherType: v.type,
                value: Number(v.value),
                maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
                minPurchase: v.minPurchase ? Number(v.minPurchase) : 0,
                expiresAt: v.endDate?.toISOString() || null,
                eligible: false,
                reason: "",
                calculatedDiscount: 0,
            };

            // Check isActive (already filtered in query, but defensive)
            if (!v.isActive) {
                result.reason = "Voucher ini sudah tidak aktif.";
                vouchers.push(result);
                continue;
            }

            // Check expiry
            if (v.startDate && now < v.startDate) {
                result.reason = "Voucher ini belum bisa digunakan.";
                vouchers.push(result);
                continue;
            }

            if (v.endDate && now > v.endDate) {
                result.reason = "Voucher ini sudah kedaluwarsa.";
                vouchers.push(result);
                continue;
            }

            // Check global quota
            if (v.quota !== null && v.usedCount >= v.quota) {
                result.reason = "Kuota voucher ini sudah habis.";
                vouchers.push(result);
                continue;
            }

            // Check per-user usage
            const usageCount = userUsageMap.get(v.id) ?? 0;
            if (v.maxUsagePerUser && usageCount >= v.maxUsagePerUser) {
                result.reason = `Anda sudah mencapai batas penggunaan voucher ini (${v.maxUsagePerUser}x).`;
                vouchers.push(result);
                continue;
            }

            // Check campaign restriction
            if (v.campaignId) {
                const campaign = campaignMap.get(v.campaignId);

                if (!campaign) {
                    result.reason = "Kampanye terkait voucher tidak ditemukan.";
                    vouchers.push(result);
                    continue;
                }

                if (
                    campaign.status !== "ACTIVE" ||
                    now < campaign.startAt ||
                    now > campaign.endAt
                ) {
                    result.reason = "Kampanye terkait voucher sedang tidak aktif.";
                    vouchers.push(result);
                    continue;
                }
            }

            // Check eligibility
            if (v.eligibility && v.eligibility !== "ALL") {
                if (v.eligibility === "NEW_USER" && paidOrderCount > 0) {
                    result.reason = "Voucher ini hanya berlaku untuk pengguna baru.";
                    vouchers.push(result);
                    continue;
                }

                if (v.eligibility === "RETURNING_USER" && paidOrderCount === 0) {
                    result.reason = "Voucher ini hanya berlaku untuk pengguna yang sudah pernah berbelanja.";
                    vouchers.push(result);
                    continue;
                }
            }

            // Check product restrictions
            if (v.productRestrictions.length > 0 && items.length > 0) {
                const allowedProductIds = new Set(
                    v.productRestrictions.map((pr: any) => pr.productId)
                );
                const hasDisallowed = items.some(
                    (item) => !allowedProductIds.has(item.productId)
                );
                if (hasDisallowed) {
                    result.reason =
                        "Voucher ini tidak berlaku untuk beberapa produk di keranjang Anda.";
                    vouchers.push(result);
                    continue;
                }
            }

            // Check category restrictions
            if (v.categoryRestrictions.length > 0 && items.length > 0) {
                const allowedCategories = new Set(
                    v.categoryRestrictions.map((cr: any) => cr.category.toLowerCase())
                );
                const hasDisallowed = items.some((item) => {
                    if (!item.category) return true;
                    return !allowedCategories.has(item.category.toLowerCase());
                });
                if (hasDisallowed) {
                    result.reason =
                        "Voucher ini tidak berlaku untuk beberapa kategori produk di keranjang Anda.";
                    vouchers.push(result);
                    continue;
                }
            }

            // Check minimum purchase
            if (result.minPurchase > 0 && subtotal < result.minPurchase) {
                result.reason = `Minimal belanja Rp ${result.minPurchase.toLocaleString("id-ID")} untuk pakai voucher ini.`;
                vouchers.push(result);
                continue;
            }

            // Voucher is eligible — calculate discount preview
            result.eligible = true;

            if (v.type === "PERCENTAGE") {
                let discount = (subtotal * Number(v.value)) / 100;
                if (v.maxDiscount && discount > Number(v.maxDiscount)) {
                    discount = Number(v.maxDiscount);
                }
                result.calculatedDiscount = Math.round(
                    Math.min(discount, subtotal)
                );
            } else {
                result.calculatedDiscount = Math.round(
                    Math.min(Number(v.value), subtotal)
                );
            }

            vouchers.push(result);
        }

        // ==========================================
        // 5. FETCH SPIN WHEEL REWARDS
        // ==========================================

        const spinWheelRewards: any[] = [];

        // Find active spin wheel campaign
        const activeCampaign = await prisma.spinWheelCampaign.findFirst({
            where: {
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
            },
            orderBy: { createdAt: "desc" },
        });

        if (activeCampaign) {
            // Fetch user's AVAILABLE spin wheel spins
            const availableSpins = await prisma.spinWheelSpin.findMany({
                where: {
                    campaignId: activeCampaign.id,
                    userId,
                    status: "AVAILABLE",
                },
                include: {
                    reward: true,
                },
                orderBy: { createdAt: "desc" },
            });

            for (const spin of availableSpins) {
                // Check expiry
                if (spin.expiresAt && spin.expiresAt < now) {
                    continue;
                }

                const reward = spin.reward;

                let reason = "";
                let eligible = true;

                // Determine eligibility based on reward type
                if (reward.type === "ZONK") {
                    eligible = false;
                    reason = "Reward ini tidak memberikan diskon.";
                } else if (reward.type === "CASHBACK") {
                    eligible = false;
                    reason = "Cashback tidak berlaku sebagai diskon di checkout.";
                } else if (reward.type === "FREE_SHIPPING") {
                    eligible = true;
                    // No discount preview for free shipping
                } else if (
                    reward.type === "FIXED" ||
                    reward.type === "PERCENTAGE"
                ) {
                    eligible = true;
                }

                let calculatedDiscount = 0;
                if (eligible) {
                    calculatedDiscount = calculateSpinRewardDiscount(
                        reward.type,
                        Number(reward.value),
                        reward.maxDiscount ? Number(reward.maxDiscount) : null,
                        subtotal
                    );
                }

                spinWheelRewards.push({
                    id: spin.id,
                    type: "SPIN_WHEEL_REWARD" as const,
                    title: reward.name,
                    spinId: spin.id,
                    rewardId: reward.id,
                    rewardType: reward.type,
                    value: Number(reward.value),
                    maxDiscount: reward.maxDiscount
                        ? Number(reward.maxDiscount)
                        : null,
                    minPurchase: 0,
                    expiresAt: spin.expiresAt?.toISOString() || null,
                    eligible,
                    reason,
                    calculatedDiscount,
                });
            }
        }

        // ==========================================
        // 6. SORTING
        // ==========================================
        //
        // Eligible first, sorted by calculatedDiscount DESC, then expiry ASC.
        // Ineligible last.

        const sortedVouchers = vouchers.sort((a, b) => {
            if (a.eligible && !b.eligible) return -1;
            if (!a.eligible && b.eligible) return 1;
            if (a.eligible && b.eligible) {
                if (b.calculatedDiscount !== a.calculatedDiscount) {
                    return b.calculatedDiscount - a.calculatedDiscount;
                }
                // Expiry ASC (soonest first)
                if (a.expiresAt && b.expiresAt) {
                    return (
                        new Date(a.expiresAt).getTime() -
                        new Date(b.expiresAt).getTime()
                    );
                }
                if (a.expiresAt && !b.expiresAt) return -1;
                if (!a.expiresAt && b.expiresAt) return 1;
            }
            return 0;
        });

        const sortedSpinRewards = spinWheelRewards.sort((a, b) => {
            if (a.eligible && !b.eligible) return -1;
            if (!a.eligible && b.eligible) return 1;
            if (a.eligible && b.eligible) {
                return b.calculatedDiscount - a.calculatedDiscount;
            }
            return 0;
        });

        return NextResponse.json({
            success: true,
            data: {
                vouchers: sortedVouchers,
                spinWheelRewards: sortedSpinRewards,
            },
        });
    } catch (error) {
        console.error("VOUCHERS AVAILABLE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil voucher tersedia.",
            },
            { status: 500 }
        );
    }
}
