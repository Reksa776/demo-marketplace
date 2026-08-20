"use client";

import { useEffect } from "react";

type TikTokPixelProps = {
    pixelId: string | null | undefined;
};

export default function TikTokPixel({
    pixelId,
}: TikTokPixelProps) {
    useEffect(() => {
        if (!pixelId) {
            return;
        }

        const existingScript = document.querySelector(
            `script[data-tiktok-pixel="${pixelId}"]`
        );

        if (existingScript) {
            return;
        }

        const script = document.createElement("script");

        script.setAttribute(
            "data-tiktok-pixel",
            pixelId
        );

        script.innerHTML = `
            !function (w, d, t) {
                w.TiktokAnalyticsObject = t;

                var ttq = w[t] = w[t] || [];

                ttq.methods = [
                    "page",
                    "track",
                    "identify",
                    "instances",
                    "debug",
                    "on",
                    "off",
                    "once",
                    "ready",
                    "alias",
                    "group",
                    "enableCookie",
                    "disableCookie"
                ];

                ttq.setAndDefer = function(t, e) {
                    t[e] = function() {
                        t.push(
                            [e].concat(
                                Array.prototype.slice.call(
                                    arguments,
                                    0
                                )
                            )
                        );
                    };
                };

                for (
                    var i = 0;
                    i < ttq.methods.length;
                    i++
                ) {
                    ttq.setAndDefer(
                        ttq,
                        ttq.methods[i]
                    );
                }

                ttq.instance = function(t) {
                    var e = ttq._i[t] || [];

                    for (
                        var n = 0;
                        n < ttq.methods.length;
                        n++
                    ) {
                        ttq.setAndDefer(
                            e,
                            ttq.methods[n]
                        );
                    }

                    return e;
                };

                ttq.load = function(e, n) {
                    var r =
                        "https://analytics.tiktok.com/i18n/pixel/events.js";

                    ttq._i = ttq._i || {};
                    ttq._i[e] = [];
                    ttq._i[e]._u = r;

                    ttq._t = ttq._t || {};
                    ttq._t[e] = +new Date;

                    ttq._o = ttq._o || {};
                    ttq._o[e] = n || {};

                    var o = d.createElement("script");

                    o.type = "text/javascript";
                    o.async = true;

                    o.src =
                        r +
                        "?sdkid=" +
                        e +
                        "&lib=" +
                        t;

                    var a =
                        d.getElementsByTagName(
                            "script"
                        )[0];

                    a.parentNode.insertBefore(
                        o,
                        a
                    );

                    ttq.instance(e);
                };

                ttq.load("${pixelId}");
                ttq.page();

                /*
                 * Beri tahu React bahwa
                 * TikTok Pixel sudah tersedia.
                 */
                window.dispatchEvent(
                    new Event("tiktok-pixel-ready")
                );
            }(
                window,
                document,
                "ttq"
            );
        `;

        document.head.appendChild(script);

        return () => {
            /*
             * Jangan remove script.
             *
             * Pixel harus tetap aktif
             * selama aplikasi berjalan.
             */
        };
    }, [pixelId]);

    return null;
}