/**
 * ==========================================
 * PUBLIC PROMOTION LIST
 * ==========================================
 *
 * GET /api/promotions
 *
 * Returns active, publicly eligible promotions.
 * No ADMIN auth required.
 *
 * Query params:
 *   page      — page number (default 1)
 *   limit     — items per page (default 20, max 50)
 *   placement — filter by placement
 *               HOMEPAGE | CAMPAIGN | CATEGORY | PRODUCT
 *
 * Only returns promotions that are:
 *   - isActive = true
 *   - startAt == null OR startAt <= now
 *   - endAt == null OR endAt >= now
 *
 * NOTE:
 *   Promotion model does NOT have campaignId.
 *   Campaign-specific filtering is a structural
 *   limitation documented in Phase 4E.
 */

import { NextResponse } from "next/server";
import {
    getActivePromotions,
} from "@/lib/marketing/promotion";
import { PromotionPlacement } from "@prisma/client";

const VALID_PLACEMENTS = [
    "HOMEPAGE",
    "CAMPAIGN",
    "CATEGORY",
    "PRODUCT",
] as const;

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

        const placementParam =
            searchParams.get("placement");

        let placement: PromotionPlacement | null =
            null;

        if (placementParam) {
            const upper =
                placementParam.toUpperCase();

            if (
                VALID_PLACEMENTS.includes(
                    upper as PromotionPlacement
                )
            ) {
                placement =
                    upper as PromotionPlacement;
            } else {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Placement tidak valid. Gunakan: HOMEPAGE, CAMPAIGN, CATEGORY, atau PRODUCT.",
                    },
                    { status: 400 }
                );
            }
        }

        // ==========================================
        // FETCH PROMOTIONS
        // ==========================================
        //
        // getActivePromotions() handles:
        //   - isActive = true
        //   - startAt/endAt time window
        //   - Priority ordering
        //
        // When placement is specified, we call
        // getActivePromotions(placement).
        // When not specified, we fetch all
        // placements and combine.

        const now = new Date();
        let allPromotions: Awaited<
            ReturnType<
                typeof getActivePromotions
            >
        > = [];

        if (placement) {
            allPromotions =
                await getActivePromotions(
                    placement,
                    now
                );
        } else {
            // Fetch all placements
            for (const p of VALID_PLACEMENTS) {
                const promotions =
                    await getActivePromotions(
                        p,
                        now
                    );
                allPromotions.push(...promotions);
            }
        }

        // ==========================================
        // APPLY PAGINATION
        // ==========================================

        const total = allPromotions.length;
        const paginatedPromotions =
            allPromotions.slice(
                (page - 1) * limit,
                page * limit
            );

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        const items = paginatedPromotions.map(
            (p) => ({
                id: p.id,
                title: p.title,
                imageUrl: p.imageUrl,
                link: p.link,
                placement: p.placement,
                priority: p.priority,
                startAt: p.startAt
                    ? p.startAt.toISOString()
                    : null,
                endAt: p.endAt
                    ? p.endAt.toISOString()
                    : null,
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
            "GET PUBLIC PROMOTIONS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data promosi.",
            },
            { status: 500 }
        );
    }
}
