import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ==========================================
// TYPES
// ==========================================

export type EligibilityResult = {
    enabled: boolean;
    eligible: boolean;
    campaignId: number | null;
    minimumSpend: number;
    currentSpend: number;
    remainingSpend: number;
    spinsRemaining: number;
    hasSpun: boolean;
    rewards: Array<{ id: number; name: string; type: string }>;
};

export type SpinResult = {
    success: boolean;
    reward?: {
        id: number;
        name: string;
        type: string;
        value: number;
        maxDiscount: number | null;
    };
    message?: string;
};

// ==========================================
// ELIGIBILITY CHECK
// ==========================================

/**
 * Check if user is eligible to spin in an active campaign.
 *
 * Minimum spending is calculated from subtotal of all PAID orders
 * (paymentStatus = 'PAID'). This is consistent with how the
 * codebase defines "paid orders" for voucher eligibility.
 */
export async function checkEligibility(
    userId: string
): Promise<EligibilityResult> {
    const now = new Date();

    // Find active campaign
    const campaign = await prisma.spinWheelCampaign.findFirst({
        where: {
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        },
        orderBy: { createdAt: "desc" },
    });

    if (!campaign) {
        return {
            enabled: false,
            eligible: false,
            campaignId: null,
            minimumSpend: 0,
            currentSpend: 0,
            remainingSpend: 0,
            spinsRemaining: 0,
            hasSpun: false,
            rewards: [],
        };
    }

    const minimumSpend = Number(campaign.minimumSpend);

    // Calculate user's total paid spend (subtotal of PAID orders)
    const paidOrders = await prisma.order.aggregate({
        where: {
            userId,
            paymentStatus: "PAID",
        },
        _sum: {
            subtotal: true,
        },
    });

    const currentSpend = Number(paidOrders._sum.subtotal ?? 0);
    const remainingSpend = Math.max(0, minimumSpend - currentSpend);
    const eligible = currentSpend >= minimumSpend && minimumSpend > 0;

    // Check how many spins user has remaining
    const existingSpins = await prisma.spinWheelSpin.count({
        where: {
            campaignId: campaign.id,
            userId,
            status: { in: ["AVAILABLE", "USED"] },
        },
    });

    const spinsRemaining = Math.max(
        0,
        campaign.maxSpinsPerUser - existingSpins
    );

    // Fetch active rewards for this campaign (for frontend segment mapping)
    const campaignRewards = await prisma.spinWheelReward.findMany({
        where: {
            campaignId: campaign.id,
            isActive: true,
        },
        orderBy: { id: "asc" },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });

    return {
        enabled: true,
        eligible: eligible && spinsRemaining > 0,
        campaignId: campaign.id,
        minimumSpend,
        currentSpend,
        remainingSpend,
        spinsRemaining,
        hasSpun: existingSpins > 0,
        rewards: campaignRewards,
    };
}

// ==========================================
// WEIGHTED RANDOM REWARD SELECTION
// ==========================================

/**
 * Select a reward from campaign rewards using weighted random.
 * This runs SERVER-SIDE only. Never trust client for reward selection.
 *
 * Algorithm: cumulative weight approach
 * 1. Sum all active rewards' weights
 * 2. Generate random number in [0, totalWeight)
 * 3. Walk through rewards until cumulative weight exceeds random number
 *
 * Also respects remaining quantity: rewards with totalQuantity set
 * and usedQuantity >= totalQuantity are excluded.
 */
export async function selectReward(
    tx: Prisma.TransactionClient,
    campaignId: number
): Promise<{
    id: number;
    name: string;
    type: string;
    value: number;
    maxDiscount: number | null;
} | null> {
    const rewards = await tx.spinWheelReward.findMany({
        where: {
            campaignId,
            isActive: true,
        },
        orderBy: { id: "asc" },
    });

    if (rewards.length === 0) return null;

    // Filter out rewards that are out of stock
    const availableRewards = rewards.filter((r) => {
        if (r.totalQuantity === null) return true;
        return r.usedQuantity < r.totalQuantity;
    });

    if (availableRewards.length === 0) return null;

    // Calculate total weight
    const totalWeight = availableRewards.reduce(
        (sum, r) => sum + r.weight,
        0
    );

    if (totalWeight <= 0) return null;

    // Server-side random: use crypto for better randomness
    const crypto = await import("crypto");
    const randomBytes = crypto.randomBytes(4);
    const randomValue =
        (randomBytes.readUInt32BE(0) / 0xffffffff) * totalWeight;

    // Select reward based on cumulative weight
    let cumulative = 0;
    for (const reward of availableRewards) {
        cumulative += reward.weight;
        if (randomValue < cumulative) {
            return {
                id: reward.id,
                name: reward.name,
                type: reward.type,
                value: Number(reward.value),
                maxDiscount: reward.maxDiscount
                    ? Number(reward.maxDiscount)
                    : null,
            };
        }
    }

    // Fallback: return last reward (shouldn't happen due to float math)
    const lastReward =
        availableRewards[availableRewards.length - 1];
    return {
        id: lastReward.id,
        name: lastReward.name,
        type: lastReward.type,
        value: Number(lastReward.value),
        maxDiscount: lastReward.maxDiscount
            ? Number(lastReward.maxDiscount)
            : null,
    };
}

// ==========================================
// EXECUTE SPIN
// ==========================================

/**
 * Execute a spin for a user. Uses transaction + unique constraint
 * to prevent double spins.
 *
 * Flow:
 * 1. Find active campaign
 * 2. Verify eligibility (minimum spend)
 * 3. Check spin availability (FOR UPDATE via unique constraint)
 * 4. Select reward server-side (weighted random)
 * 5. Create spin record (unique constraint prevents duplicates)
 * 6. Increment reward usedQuantity
 * 7. Return reward to client (for animation)
 */
export async function executeSpin(
    userId: string
): Promise<SpinResult> {
    const now = new Date();

    // Find active campaign
    const campaign = await prisma.spinWheelCampaign.findFirst({
        where: {
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        },
        orderBy: { createdAt: "desc" },
    });

    if (!campaign) {
        return {
            success: false,
            message: "Tidak ada kampanye spin wheel aktif.",
        };
    }

    // Calculate paid spend
    const paidOrders = await prisma.order.aggregate({
        where: {
            userId,
            paymentStatus: "PAID",
        },
        _sum: { subtotal: true },
    });

    const currentSpend = Number(paidOrders._sum.subtotal ?? 0);
    const minimumSpend = Number(campaign.minimumSpend);

    if (currentSpend < minimumSpend || minimumSpend <= 0) {
        return {
            success: false,
            message: "Belum memenuhi minimum belanja untuk spin.",
        };
    }

    // Check spin availability + create atomically
    return prisma.$transaction(async (tx) => {
        // Count existing spins
        const existingSpins = await tx.spinWheelSpin.count({
            where: {
                campaignId: campaign.id,
                userId,
                status: { in: ["AVAILABLE", "USED"] },
            },
        });

        if (existingSpins >= campaign.maxSpinsPerUser) {
            return {
                success: false,
                message: "Semua kesempatan spin sudah digunakan.",
            };
        }

        // Select reward server-side
        const reward = await selectReward(tx, campaign.id);

        if (!reward) {
            return {
                success: false,
                message: "Tidak ada reward tersedia saat ini.",
            };
        }

        // Create spin record
        // Unique constraint on [campaignId, userId] prevents duplicate
        try {
            await tx.spinWheelSpin.create({
                data: {
                    campaignId: campaign.id,
                    userId,
                    rewardId: reward.id,
                    status: "AVAILABLE",
                    expiresAt:
                        reward.type === "ZONK"
                            ? null
                            : new Date(
                                  now.getTime() + 30 * 24 * 60 * 60 * 1000
                              ), // 30 days
                },
            });
        } catch (err: any) {
            // P2002 = unique constraint violation = already spun
            if (err?.code === "P2002") {
                return {
                    success: false,
                    message: "Anda sudah melakukan spin untuk kampanye ini.",
                };
            }
            throw err;
        }

        // Increment usedQuantity on reward
        await tx.spinWheelReward.update({
            where: { id: reward.id },
            data: {
                usedQuantity: { increment: 1 },
            },
        });

        return {
            success: true,
            reward,
        };
    });
}

// ==========================================
// CALCULATE DISCOUNT FROM REWARD
// ==========================================

/**
 * Calculate the actual discount amount from a spin wheel reward.
 * Used at checkout time.
 *
 * @param rewardType - The reward type
 * @param rewardValue - The reward value (percentage or fixed amount)
 * @param maxDiscount - Maximum discount cap (for percentage type)
 * @param subtotal - Order subtotal
 */
export function calculateSpinRewardDiscount(
    rewardType: string,
    rewardValue: number,
    maxDiscount: number | null,
    subtotal: number
): number {
    switch (rewardType) {
        case "PERCENTAGE": {
            let discount = (subtotal * rewardValue) / 100;
            if (maxDiscount !== null && discount > maxDiscount) {
                discount = maxDiscount;
            }
            if (discount > subtotal) {
                discount = subtotal;
            }
            return Math.round(discount);
        }

        case "FIXED": {
            let discount = rewardValue;
            if (discount > subtotal) {
                discount = subtotal;
            }
            return Math.round(discount);
        }

        case "FREE_SHIPPING":
            // Shipping discount handled separately in checkout
            return 0;

        case "CASHBACK":
            // Cashback is not a direct discount
            return 0;

        case "ZONK":
            return 0;

        default:
            return 0;
    }
}
