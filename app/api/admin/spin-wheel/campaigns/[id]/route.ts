import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ==========================================
// AUTH HELPER
// ==========================================

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            ),
        };
    }
    if (session.user.role !== "ADMIN") {
        return {
            error: NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            ),
        };
    }
    return { session };
}

type RouteContext = {
    params: Promise<{ id: string }>;
};

// ==========================================
// PATCH /api/admin/spin-wheel/campaigns/[id]
// ==========================================

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id } = await context.params;
        const campaignId = Number(id);

        if (!Number.isInteger(campaignId) || campaignId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID campaign tidak valid." },
                { status: 400 }
            );
        }

        const existing = await prisma.spinWheelCampaign.findUnique({
            where: { id: campaignId },
            include: { rewards: true },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Campaign tidak ditemukan." },
                { status: 404 }
            );
        }

        const body = await request.json();

        // Build update data
        const updateData: any = {};

        if (body.name !== undefined) {
            const name = String(body.name).trim();
            if (!name) {
                return NextResponse.json(
                    { success: false, message: "Nama tidak boleh kosong." },
                    { status: 400 }
                );
            }
            updateData.name = name;
        }

        if (body.description !== undefined) {
            updateData.description =
                typeof body.description === "string"
                    ? body.description.trim() || null
                    : null;
        }

        if (body.minimumSpend !== undefined) {
            const v = Number(body.minimumSpend);
            if (!Number.isFinite(v) || v < 0) {
                return NextResponse.json(
                    { success: false, message: "Minimum belanja tidak valid." },
                    { status: 400 }
                );
            }
            updateData.minimumSpend = v;
        }

        if (body.maxSpinsPerUser !== undefined) {
            const v = Number(body.maxSpinsPerUser);
            if (!Number.isInteger(v) || v < 1) {
                return NextResponse.json(
                    { success: false, message: "Max spin per user tidak valid." },
                    { status: 400 }
                );
            }
            updateData.maxSpinsPerUser = v;
        }

        if (body.isActive !== undefined) {
            updateData.isActive = Boolean(body.isActive);
        }

        if (body.startAt !== undefined) {
            const v = new Date(body.startAt);
            if (isNaN(v.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal mulai tidak valid." },
                    { status: 400 }
                );
            }
            updateData.startAt = v;
        }

        if (body.endAt !== undefined) {
            const v = new Date(body.endAt);
            if (isNaN(v.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal selesai tidak valid." },
                    { status: 400 }
                );
            }
            updateData.endAt = v;
        }

        // Update campaign
        const updatedCampaign = await prisma.$transaction(async (tx) => {
            const updated = await tx.spinWheelCampaign.update({
                where: { id: campaignId },
                data: updateData,
            });

            // Update rewards if provided
            if (Array.isArray(body.rewards)) {
                const validRewardTypes = [
                    "PERCENTAGE",
                    "FIXED",
                    "FREE_SHIPPING",
                    "CASHBACK",
                    "ZONK",
                ];

                for (const r of body.rewards) {
                    if (r.id) {
                        // Update existing reward
                        const rewardUpdate: any = {};
                        if (r.name) rewardUpdate.name = r.name.trim();
                        if (r.type && validRewardTypes.includes(r.type)) {
                            rewardUpdate.type = r.type;
                            if (r.type === "ZONK") {
                                rewardUpdate.value = 0;
                            }
                        }
                        if (r.value !== undefined && r.type !== "ZONK") {
                            rewardUpdate.value = Number(r.value);
                        }
                        if (r.maxDiscount !== undefined) {
                            rewardUpdate.maxDiscount = r.maxDiscount
                                ? Number(r.maxDiscount)
                                : null;
                        }
                        if (r.weight !== undefined) {
                            rewardUpdate.weight = Number(r.weight);
                        }
                        if (r.totalQuantity !== undefined) {
                            rewardUpdate.totalQuantity = r.totalQuantity
                                ? Number(r.totalQuantity)
                                : null;
                        }
                        if (r.isActive !== undefined) {
                            rewardUpdate.isActive = Boolean(r.isActive);
                        }

                        await tx.spinWheelReward.update({
                            where: { id: r.id },
                            data: rewardUpdate,
                        });
                    } else if (r.name && r.type) {
                        // Create new reward
                        if (!validRewardTypes.includes(r.type)) {
                            throw new Error(`Tipe reward "${r.type}" tidak valid.`);
                        }
                        await tx.spinWheelReward.create({
                            data: {
                                campaignId,
                                name: r.name.trim(),
                                type: r.type,
                                value: r.type === "ZONK" ? 0 : Number(r.value ?? 0),
                                maxDiscount: r.maxDiscount ? Number(r.maxDiscount) : null,
                                weight: Number(r.weight ?? 1),
                                totalQuantity: r.totalQuantity
                                    ? Number(r.totalQuantity)
                                    : null,
                                isActive: r.isActive !== false,
                            },
                        });
                    }
                }
            }

            return updated;
        });

        return NextResponse.json({
            success: true,
            data: { id: updatedCampaign.id },
        });
    } catch (error: any) {
        console.error("UPDATE SPIN WHEEL CAMPAIGN ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengubah campaign." },
            { status: 500 }
        );
    }
}

// ==========================================
// DELETE /api/admin/spin-wheel/campaigns/[id]
// ==========================================

export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id } = await context.params;
        const campaignId = Number(id);

        if (!Number.isInteger(campaignId) || campaignId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID campaign tidak valid." },
                { status: 400 }
            );
        }

        const existing = await prisma.spinWheelCampaign.findUnique({
            where: { id: campaignId },
            include: { _count: { select: { spins: true } } },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Campaign tidak ditemukan." },
                { status: 404 }
            );
        }

        if (existing._count.spins > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tidak bisa menghapus campaign yang sudah memiliki spin history. Nonaktifkan saja.",
                },
                { status: 400 }
            );
        }

        // Delete rewards first (cascade should handle this, but explicit is safer)
        await prisma.spinWheelReward.deleteMany({
            where: { campaignId },
        });

        await prisma.spinWheelCampaign.delete({
            where: { id: campaignId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE SPIN WHEEL CAMPAIGN ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus campaign." },
            { status: 500 }
        );
    }
}
