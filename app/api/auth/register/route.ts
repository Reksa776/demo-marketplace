import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/register";
import { rateLimiters, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        // Rate limiting
        const clientIp = getClientIp(req);
        const rateLimit = rateLimiters.register(clientIp);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
                { status: 429 }
            );
        }

        const body = await req.json();

        const data = registerSchema.parse(body);

        if (!data.email && !data.phone) {
            return NextResponse.json(
                {
                    message:
                        "Email atau nomor HP wajib diisi.",
                },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    ...(data.email
                        ? [{ email: data.email }]
                        : []),

                    ...(data.phone
                        ? [{ phone: data.phone }]
                        : []),
                ],
            },
        });

        if (existing) {
            return NextResponse.json(
                {
                    message:
                        "Email atau nomor HP sudah digunakan.",
                },
                { status: 400 }
            );
        }

        const hashedPassword =
            await hashPassword(data.password);

        const referralCode = `REF${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email || null,
                phone: data.phone || null,
                password: hashedPassword,
                referralCode,
                referredBy:
                    data.referralCode || null,
            },
        });

        return NextResponse.json(
            {
                message: "Register berhasil",

                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("REGISTER ERROR:", error);

        return NextResponse.json(
            {
                message:
                    error?.message ||
                    "Terjadi kesalahan.",
            },
            { status: 500 }
        );
    }
}