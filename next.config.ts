import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "192.168.2.49",
        "103.93.132.21",
        "202.73.25.122",
        "demosolusisejalan.my.id",
        "got-feof-calgary-wants.trycloudflare.com",
    ],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "down-id.img.susercontent.com",
            },
        ],
    },
    /**
     * Server-only external packages.
     *
     * These packages are NOT bundled by Turbopack/
     * webpack on the server side. They are resolved
     * at runtime from node_modules.
     *
     * Baileys must be externalized because:
     * 1. It pulls in jimp (image processing) which
     *    Turbopack cannot resolve
     * 2. It has native/optional dependencies that
     *    should not be bundled
     * 3. We only use text messaging — no media deps
     *    needed at bundle time
     */
    serverExternalPackages: [
        "@whiskeysockets/baileys",
    ],
};

export default nextConfig;
