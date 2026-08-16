import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "192.168.2.49",
        "202.73.25.122",
        "demosolusisejalan.my.id",
        "974b-2404-8000-104e-773-5f3c-bac5-34a1-c49e.ngrok-free.app",
    ],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "down-id.img.susercontent.com",
            },
        ],
    },
};

export default nextConfig;
