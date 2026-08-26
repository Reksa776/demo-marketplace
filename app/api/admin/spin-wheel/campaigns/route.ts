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

// ==========================================
// GET /api/admin/spin-wheel/campaigns
// ==========================================

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { searchParams } = new URL(request.url);
        const rawPage = Number(searchParams.get("page") ?? "1");
        const rawLimit = Number(searchParams.get("limit") ?? "20");

        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit =
            Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100
                ? rawLimit
                : 20;
        const offset = (page - 1) * limit;

        const search = searchParams.get("search")?.trim() || undefined;

        const where: any = {};
        if (search) {
            where.name = { contains: search };
        }

        const [campaigns, total] = await Promise.all([
            prisma.spinWheelCampaign.findMany({
                where,
                include: {
                    rewards: {
                        orderBy: { id: "asc" },
                    },
                    _count: {
                        select: { spins: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
            }),
            prisma.spinWheelCampaign.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: {
                items: campaigns.map((c) => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    minimumSpend: Number(c.minimumSpend),
                    maxSpinsPerUser: c.maxSpinsPerUser,
                    startAt: c.startAt.toISOString(),
                    endAt: c.endAt.toISOString(),
                    isActive: c.isActive,
                    createdAt: c.createdAt.toISOString(),
                    updatedAt: c.updatedAt.toISOString(),
                    spinCount: c._count.spins,
                    rewards: c.rewards.map((r) => ({
                        id: r.id,
                        name: r.name,
                        type: r.type,
                        value: Number(r.value),
                        maxDiscount: r.maxDiscount ? Number(r.maxDiscount) : null,
                        weight: r.weight,
                        totalQuantity: r.totalQuantity,
                        usedQuantity: r.usedQuantity,
                        isActive: r.isActive,
                    })),
                })),
                pagination: { page, limit, total, totalPages },
            },
        });
    } catch (error) {
        console.error("LIST SPIN WHEEL CAMPAIGNS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data campaign." },
            { status: 500 }
        );
    }
}

// ==========================================
// POST /api/admin/spin-wheel/campaigns
// ==========================================

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const body = await request.json();

        // Validate name
        if (typeof body.name !== "string" || !body.name.trim()) {
            return NextResponse.json(
                { success: false, message: "Nama campaign wajib diisi." },
                { status: 400 }
            );
        }
        const name = body.name.trim();

        // Generate slug
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Check slug uniqueness
        const existingSlug = await prisma.spinWheelCampaign.findUnique({
            where: { slug },
        });
        if (existingSlug) {
            return NextResponse.json(
                { success: false, message: "Nama campaign sudah digunakan." },
                { status: 409 }
            );
        }

        // Validate minimumSpend
        const minimumSpend = Number(body.minimumSpend ?? 0);
        if (!Number.isFinite(minimumSpend) || minimumSpend < 0) {
            return NextResponse.json(
                { success: false, message: "Minimum belanja tidak valid." },
                { status: 400 }
            );
        }

        // Validate maxSpinsPerUser (0 = no cap, >1 = lifetime cap)
        const maxSpinsPerUser = Number(body.maxSpinsPerUser ?? 0);
        if (!Number.isInteger(maxSpinsPerUser) || maxSpinsPerUser < 0) {
            return NextResponse.json(
                { success: false, message: "Max spin per user tidak valid." },
                { status: 400 }
            );
        }

        // Validate dates
        if (!body.startAt || !body.endAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal wajib diisi." },
                { status: 400 }
            );
        }
        const startAt = new Date(body.startAt);
        const endAt = new Date(body.endAt);
        if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
            return NextResponse.json(
                { success: false, message: "Format tanggal tidak valid." },
                { status: 400 }
            );
        }
        if (endAt <= startAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal selesai harus setelah tanggal mulai." },
                { status: 400 }
            );
        }

        // Validate and create rewards
        const validRewardTypes = [
            "PERCENTAGE",
            "FIXED",
            "FREE_SHIPPING",
            "CASHBACK",
            "ZONK",
        ];
        const rewards = Array.isArray(body.rewards) ? body.rewards : [];

        if (rewards.length === 0) {
            return NextResponse.json(
                { success: false, message: "Minimal harus ada 1 reward." },
                { status: 400 }
            );
        }

        for (const r of rewards) {
            if (!r.name || typeof r.name !== "string") {
                return NextResponse.json(
                    { success: false, message: "Nama reward wajib diisi." },
                    { status: 400 }
                );
            }
            if (!validRewardTypes.includes(r.type)) {
                return NextResponse.json(
                    { success: false, message: `Tipe reward "${r.type}" tidak valid.` },
                    { status: 400 }
                );
            }
            if (r.type !== "ZONK") {
                const value = Number(r.value);
                if (!Number.isFinite(value) || value <= 0) {
                    return NextResponse.json(
                        { success: false, message: `Nilai reward "${r.name}" tidak valid.` },
                        { status: 400 }
                    );
                }
            }
            const weight = Number(r.weight ?? 1);
            if (!Number.isInteger(weight) || weight < 1) {
                return NextResponse.json(
                    { success: false, message: `Weight reward "${r.name}" tidak valid.` },
                    { status: 400 }
                );
            }
        }

        // Create campaign with rewards in transaction
        const campaign = await prisma.$transaction(async (tx) => {
            const created = await tx.spinWheelCampaign.create({
                data: {
                    name,
                    slug,
                    description: typeof body.description === "string" ? body.description.trim() || null : null,
                    minimumSpend,
                    maxSpinsPerUser,
                    startAt,
                    endAt,
                    isActive: body.isActive !== false,
                },
            });

            // Create rewards
            for (const r of rewards) {
                await tx.spinWheelReward.create({
                    data: {
                        campaignId: created.id,
                        name: r.name.trim(),
                        type: r.type,
                        value: r.type === "ZONK" ? 0 : Number(r.value),
                        maxDiscount: r.maxDiscount ? Number(r.maxDiscount) : null,
                        weight: Number(r.weight ?? 1),
                        totalQuantity: r.totalQuantity ? Number(r.totalQuantity) : null,
                        isActive: r.isActive !== false,
                    },
                });
            }

            return created;
        });

        return NextResponse.json(
            { success: true, data: { id: campaign.id } },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE SPIN WHEEL CAMPAIGN ERROR:", error);
        if (error?.code === "P2002") {
            return NextResponse.json(
                { success: false, message: "Campaign dengan nama yang sama sudah ada." },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { success: false, message: "Gagal membuat campaign." },
            { status: 500 }
        );
    }
}
