import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function checkAdmin() {
    const session = await auth();

    if (!session?.user) {
        return {
            ok: false,
            status: 401,
            message: "Unauthorized.",
        };
    }

    const role = (session.user as any).role;

    if (role !== "ADMIN") {
        return {
            ok: false,
            status: 403,
            message:
                "Kamu tidak memiliki akses admin.",
        };
    }

    return {
        ok: true,
        status: 200,
        message: "",
    };
}

/*
|--------------------------------------------------------------------------
| GET DETAIL PRODUCT
|--------------------------------------------------------------------------
*/

export async function GET(
    _request: Request,
    context: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        const admin = await checkAdmin();

        if (!admin.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: admin.message,
                },
                {
                    status: admin.status,
                }
            );
        }

        const { id } = await context.params;

        const productId = Number(id);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID produk tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const product =
            await prisma.product.findUnique({
                where: {
                    id: productId,
                },
                include: {
                    variants: {
                        orderBy: {
                            id: "asc",
                        },
                    },
                },
            });

        if (!product) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Produk tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        return NextResponse.json({
            success: true,
            product: {
                ...product,
                variants: product.variants.map(
                    (variant) => ({
                        ...variant,
                        price: Number(
                            variant.price
                        ),
                    })
                ),
            },
        });
    } catch (error) {
        console.error(
            "GET ADMIN PRODUCT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil produk.",
            },
            {
                status: 500,
            }
        );
    }
}

/*
|--------------------------------------------------------------------------
| UPDATE PRODUCT
|--------------------------------------------------------------------------
*/

export async function PUT(
    request: Request,
    context: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        const admin = await checkAdmin();

        if (!admin.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: admin.message,
                },
                {
                    status: admin.status,
                }
            );
        }

        const { id } = await context.params;

        const productId = Number(id);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID produk tidak valid.",
                },
                {
                    status: 400,
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

        /*
         * VALIDASI PRODUCT
         */

        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
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
                    success: false,
                    message:
                        "Slug wajib diisi.",
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
                    success: false,
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
                    success: false,
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
                        success: false,
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
                        success: false,
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
                        success: false,
                        message:
                            `Stok variant "${variant.name}" tidak valid.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                !Number.isInteger(weight) ||
                weight <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
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
         * CEK PRODUCT
         */

        const existingProduct =
            await prisma.product.findUnique({
                where: {
                    id: productId,
                },
            });

        if (!existingProduct) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Produk tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * CEK SLUG
         *
         * Jangan sampai slug product lain
         * ikut bentrok.
         */

        const duplicateSlug =
            await prisma.product.findFirst({
                where: {
                    slug: slug.trim(),
                    NOT: {
                        id: productId,
                    },
                },
            });

        if (duplicateSlug) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Slug produk sudah digunakan.",
                },
                {
                    status: 409,
                }
            );
        }

        /*
         * TRANSACTION
         *
         * Variant lama dihapus lalu dibuat
         * ulang berdasarkan data terbaru.
         *
         * Ini sengaja dibuat sederhana dan
         * aman untuk CRUD admin.
         */

        const product =
            await prisma.$transaction(
                async (tx) => {
                    await tx.productVariant.deleteMany(
                        {
                            where: {
                                productId,
                            },
                        }
                    );

                    return tx.product.update({
                        where: {
                            id: productId,
                        },

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
                                    (
                                        variant: any
                                    ) => ({
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
                }
            );

        return NextResponse.json({
            success: true,
            message:
                "Produk berhasil diperbarui.",
            product: {
                ...product,
                variants: product.variants.map(
                    (variant) => ({
                        ...variant,
                        price: Number(
                            variant.price
                        ),
                    })
                ),
            },
        });
    } catch (error) {
        console.error(
            "UPDATE PRODUCT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal memperbarui produk.",
            },
            {
                status: 500,
            }
        );
    }
}

/*
|--------------------------------------------------------------------------
| DELETE PRODUCT
|--------------------------------------------------------------------------
*/

export async function DELETE(
    _request: Request,
    context: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        const admin = await checkAdmin();

        if (!admin.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: admin.message,
                },
                {
                    status: admin.status,
                }
            );
        }

        const { id } = await context.params;

        const productId = Number(id);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID produk tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const product =
            await prisma.product.findUnique({
                where: {
                    id: productId,
                },
                include: {
                    variants: true,
                },
            });

        if (!product) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Produk tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * Hapus product.
         *
         * ProductVariant akan ikut terhapus
         * karena relation:
         *
         * onDelete: Cascade
         */

        await prisma.product.delete({
            where: {
                id: productId,
            },
        });

        return NextResponse.json({
            success: true,
            message:
                "Produk berhasil dihapus.",
        });
    } catch (error) {
        console.error(
            "DELETE PRODUCT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal menghapus produk.",
            },
            {
                status: 500,
            }
        );
    }
}