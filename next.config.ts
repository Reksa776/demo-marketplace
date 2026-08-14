import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "192.168.2.49",
        "202.73.25.122",
        "demosolusisejalan.my.id",
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
