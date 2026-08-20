"use client";

import { useEffect, useState } from "react";
import TikTokPixel from "./TikTokPixel";

export default function AnalyticsProvider() {
    const [tiktokPixelId, setTiktokPixelId] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadAnalytics() {
            try {
                const response = await fetch(
                    "/api/analytics/settings",
                    {
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    return;
                }

                const data =
                    await response.json();

                if (cancelled) {
                    return;
                }

                setTiktokPixelId(
                    data?.data?.tiktokPixelId ??
                    null
                );
            } catch (error) {
                console.error(
                    "LOAD ANALYTICS SETTINGS ERROR:",
                    error
                );
            }
        }

        loadAnalytics();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <TikTokPixel
            pixelId={tiktokPixelId}
        />
    );
}