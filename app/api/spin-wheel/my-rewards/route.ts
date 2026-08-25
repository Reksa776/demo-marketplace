import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ==========================================
// GET /api/spin-wheel/my-rewards
// ==========================================
// Get current user's spin wheel rewards.

export async function GET() {
    try {
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

        const spins = await prisma.spinWheelSpin.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                reward: true,
                campaign: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Auto-expire rewards past their expiry date
        const now = new Date();
        const expiredSpins = spins.filter(
            (s) =>
                s.status === "AVAILABLE" &&
                s.expiresAt &&
                s.expiresAt < now
        );

        if (expiredSpins.length > 0) {
            await prisma.spinWheelSpin.updateMany({
                where: {
                    id: {
                        in: expiredSpins.map((s) => s.id),
                    },
                },
                data: {
                    status: "EXPIRED",
                },
            });

            // Update local state
            for (const spin of spins) {
                if (
                    spin.status === "AVAILABLE" &&
                    spin.expiresAt &&
                    spin.expiresAt < now
                ) {
                    spin.status = "EXPIRED";
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: spins.map((s) => ({
                id: s.id,
                status: s.status,
                createdAt: s.createdAt.toISOString(),
                expiresAt: s.expiresAt?.toISOString() ?? null,
                usedAt: s.usedAt?.toISOString() ?? null,
                orderId: s.orderId,
                reward: {
                    id: s.reward.id,
                    name: s.reward.name,
                    type: s.reward.type,
                    value: Number(s.reward.value),
                    maxDiscount: s.reward.maxDiscount
                        ? Number(s.reward.maxDiscount)
                        : null,
                },
                campaign: {
                    name: s.campaign.name,
                },
            })),
        });
    } catch (error) {
        console.error("MY_REWARDS_ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data reward.",
            },
            { status: 500 }
        );
    }
}
