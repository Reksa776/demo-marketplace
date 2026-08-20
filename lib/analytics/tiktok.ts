export type TikTokEventProperties = Record<
    string,
    unknown
>;

declare global {
    interface Window {
        ttq?: {
            track: (
                event: string,
                properties?: TikTokEventProperties
            ) => void;
            page?: () => void;
        };
    }
}

export function trackTikTokEvent(
    event: string,
    properties?: TikTokEventProperties
) {
    if (
        typeof window === "undefined" ||
        !window.ttq
    ) {
        return;
    }

    try {
        window.ttq.track(
            event,
            properties
        );
    } catch (error) {
        console.error(
            "TIKTOK TRACK ERROR:",
            error
        );
    }
}