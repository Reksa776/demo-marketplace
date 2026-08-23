/**
 * ==========================================
 * PUBLIC CAMPAIGN DETAIL
 * ==========================================
 *
 * GET /api/campaigns/[slug]
 *
 * Returns a single campaign by slug.
 * No ADMIN auth required.
 *
 * Only returns campaigns whose effective
 * status is ACTIVE or SCHEDULED.
 *
 * 404 for:
 *   - nonexistent slug
 *   - DRAFT campaign
 *   - CANCELLED campaign
 */

import { NextResponse } from "next/server";
import { getCampaignBySlug } from "@/lib/marketing/campaign";
import {
    calculateCampaignStatus,
} from "@/lib/marketing/campaign";
import {
    CampaignNotFoundError,
} from "@/lib/marketing/errors";

export async function GET(
    _request: Request,
    {
        params,
    }: {
        params: Promise<{
            slug: string;
        }>;
    }
) {
    try {
        const { slug } = await params;

        if (!slug || typeof slug !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slug tidak valid.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // FETCH CAMPAIGN BY SLUG
        // ==========================================

        let campaign;

        try {
            campaign =
                await getCampaignBySlug(slug);
        } catch (error) {
            if (
                error instanceof
                CampaignNotFoundError
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Kampanye tidak ditemukan.",
                    },
                    { status: 404 }
                );
            }
            throw error;
        }

        // ==========================================
        // CHECK EFFECTIVE STATUS
        // ==========================================

        const now = new Date();
        const effectiveStatus =
            calculateCampaignStatus(campaign, now);

        // Only expose ACTIVE or SCHEDULED campaigns
        if (
            effectiveStatus !== "ACTIVE" &&
            effectiveStatus !== "SCHEDULED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kampanye tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        return NextResponse.json({
            success: true,
            data: {
                id: campaign.id,
                name: campaign.name,
                slug: campaign.slug,
                description: campaign.description,
                bannerUrl: campaign.bannerUrl,
                code: campaign.code,
                type: campaign.type,
                status: effectiveStatus,
                startAt: campaign.startAt.toISOString(),
                endAt: campaign.endAt.toISOString(),
                discountType: campaign.discountType,
                discountValue: campaign.discountValue
                    ? Number(campaign.discountValue)
                    : null,
                maxDiscount: campaign.maxDiscount
                    ? Number(campaign.maxDiscount)
                    : null,
                priority: campaign.priority,
                products: campaign.products.map(
                    (p) => ({
                        productId: p.productId,
                    })
                ),
                categories: campaign.categories.map(
                    (c) => ({
                        category: c.category,
                    })
                ),
                vouchers: campaign.vouchers.map(
                    (v) => ({
                        id: v.id,
                        code: v.code,
                        description: v.description,
                        type: v.type,
                        value: Number(
                            v.value
                        ),
                    })
                ),
            },
        });
    } catch (error) {
        console.error(
            "GET PUBLIC CAMPAIGN DETAIL ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil detail kampanye.",
            },
            { status: 500 }
        );
    }
}
