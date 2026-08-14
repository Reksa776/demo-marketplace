import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json(
                {
                    message: "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        const role = (session.user as any).role;

        if (role !== "ADMIN") {
            return NextResponse.json(
                {
                    message:
                        "Kamu tidak memiliki akses admin.",
                },
                {
                    status: 403,
                }
            );
        }

        const body = await request.json();

        const {
            name,
            slug,
            description,
            category,
            image,
            bestseller,
            variants,
        } = body;

        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Nama produk wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            typeof slug !== "string" ||
            !slug.trim()
        ) {
            return NextResponse.json(
                {
                    message: "Slug wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            typeof category !== "string" ||
            !category.trim()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Kategori wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !Array.isArray(variants) ||
            variants.length === 0
        ) {
            return NextResponse.json(
                {
                    message:
                        "Minimal harus ada satu variant.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * VALIDASI VARIANT
         */
        for (const variant of variants) {
            if (
                typeof variant.name !== "string" ||
                !variant.name.trim()
            ) {
                return NextResponse.json(
                    {
                        message:
                            "Nama variant wajib diisi.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const price = Number(
                variant.price
            );

            const stock = Number(
                variant.stock
            );

            const weight = Number(
                variant.weight
            );

            if (
                !Number.isFinite(price) ||
                price <= 0
            ) {
                return NextResponse.json(
                    {
                        message:
                            `Harga variant "${variant.name}" tidak valid.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                !Number.isInteger(stock) ||
                stock < 0
            ) {
                return NextResponse.json(
                    {
                        message:
                            `Stok variant "${variant.name}" tidak valid.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            /*
             * BERAT HARUS ANGKA BULAT
             */
            if (
                !Number.isInteger(weight) ||
                weight <= 0
            ) {
                return NextResponse.json(
                    {
                        message:
                            `Berat variant "${variant.name}" wajib diisi dalam gram.`,
                    },
                    {
                        status: 400,
                    }
                );
            }
        }

        /*
         * CEK SLUG
         */
        const existingProduct =
            await prisma.product.findUnique({
                where: {
                    slug: slug.trim(),
                },
            });

        if (existingProduct) {
            return NextResponse.json(
                {
                    message:
                        "Slug produk sudah digunakan.",
                },
                {
                    status: 409,
                }
            );
        }

        /*
         * CREATE PRODUCT
         */
        const product =
            await prisma.product.create({
                data: {
                    name: name.trim(),

                    slug: slug.trim(),

                    description:
                        typeof description ===
                        "string"
                            ? description.trim() ||
                              null
                            : null,

                    category:
                        typeof category ===
                        "string"
                            ? category.trim() ||
                              null
                            : null,

                    image:
                        typeof image ===
                        "string"
                            ? image.trim() ||
                              null
                            : null,

                    bestseller:
                        Boolean(bestseller),

                    variants: {
                        create: variants.map(
                            (variant: any) => ({
                                name: variant.name.trim(),

                                price: Number(
                                    variant.price
                                ),

                                stock: Number(
                                    variant.stock
                                ),

                                weight: Number(
                                    variant.weight
                                ),

                                image:
                                    typeof variant.image ===
                                    "string"
                                        ? variant.image.trim() ||
                                          null
                                        : null,
                            })
                        ),
                    },
                },

                include: {
                    variants: true,
                },
            });

        return NextResponse.json(
            {
                success: true,
                message:
                    "Produk berhasil dibuat.",
                product,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "CREATE PRODUCT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Terjadi kesalahan saat membuat produk.",
            },
            {
                status: 500,
            }
        );
    }
}