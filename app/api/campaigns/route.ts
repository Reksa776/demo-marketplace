/**
 * ==========================================
 * PUBLIC CAMPAIGN LIST
 * ==========================================
 *
 * GET /api/campaigns
 *
 * Returns publicly eligible campaigns.
 * No ADMIN auth required.
 *
 * Query params:
 *   page    — page number (default 1)
 *   limit   — items per page (default 20, max 50)
 *   search  — optional search by name/slug
 */

import { NextResponse } from "next/server";
import {
    listCampaigns,
    calculateCampaignStatus,
} from "@/lib/marketing/campaign";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(
            request.url
        );

        // ==========================================
        // PARSE & VALIDATE QUERY PARAMS
        // ==========================================

        const page = Math.max(
            1,
            parseInt(
                searchParams.get("page") ?? "1",
                10
            ) || 1
        );

        const limit = Math.min(
            50,
            Math.max(
                1,
                parseInt(
                    searchParams.get("limit") ??
                        "20",
                    10
                ) || 20
            )
        );

        const search =
            searchParams.get("search")?.trim() ||
            undefined;

        const offset = (page - 1) * limit;

        // ==========================================
        // FETCH CAMPAIGNS
        // ==========================================

        // List campaigns that are NOT ended/cancelled
        // (DRAFT, SCHEDULED, ACTIVE are acceptable)
        const { campaigns, total } =
            await listCampaigns({
                includeEnded: false,
                search,
                limit,
                offset,
            });

        // ==========================================
        // FILTER BY EFFECTIVE STATUS
        // ==========================================
        //
        // Only return campaigns whose EFFECTIVE
        // status (computed from startAt/endAt)
        // is either ACTIVE or SCHEDULED.
        //
        // Exclude DRAFT even if stored as
        // non-cancelled (admin-only).

        const now = new Date();

        const publicCampaigns = campaigns.filter(
            (c) => {
                const effectiveStatus =
                    calculateCampaignStatus(c, now);

                return (
                    effectiveStatus === "ACTIVE" ||
                    effectiveStatus === "SCHEDULED"
                );
            }
        );

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        const items = publicCampaigns.map(
            (c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                bannerUrl: c.bannerUrl,
                type: c.type,
                status: calculateCampaignStatus(
                    c,
                    now
                ),
                startAt: c.startAt.toISOString(),
                endAt: c.endAt.toISOString(),
                discountType: c.discountType,
                discountValue: c.discountValue
                    ? Number(c.discountValue)
                    : null,
                maxDiscount: c.maxDiscount
                    ? Number(c.maxDiscount)
                    : null,
                priority: c.priority,
                productCount: c.products.length,
                categoryCount: c.categories.length,
                categories: c.categories.map(
                    (cat) => cat.category
                ),
            })
        );

        return NextResponse.json({
            success: true,
            data: {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(
                        total / limit
                    ),
                },
            },
        });
    } catch (error) {
        console.error(
            "GET PUBLIC CAMPAIGNS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data kampanye.",
            },
            { status: 500 }
        );
    }
}
