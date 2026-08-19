import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: [
        "192.168.2.49",
        "202.73.25.122",
        "demosolusisejalan.my.id",
        "94cb-2401-e320-506-9110-9-faed-bae9-244b.ngrok-free.app",
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
