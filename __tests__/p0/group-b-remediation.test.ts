/**
 * ==========================================
 * GROUP B REMEDIATION — BEHAVIORAL TESTS
 * ==========================================
 *
 * Executes real code against the real MariaDB database (`toko`).
 *
 * Coverage:
 *   A. F1/F2: Bulk discount picks the best QUALIFYING tier
 *             (highest minQuantity <= quantity), falling back
 *             from variant-level to product-level tiers.
 *   B. F9:    Shipping-discount quota is reserved atomically (CAS)
 *             and released on cancel; exhausted quota yields null.
 *
 * All seeded rows use a unique suffix and are removed in afterAll.
 */

jest.mock("@/auth", () => ({
    auth: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
    resolveBatchPrices,
} from "@/lib/marketing/batch-pricing";
import {
    calculateShippingDiscount,
    reserveShippingDiscountUsage,
    releaseShippingDiscountUsage,
} from "@/lib/marketing/shipping-discount";
import { POST as cartPOST } from "@/app/api/cart/route";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- mock auth via require to avoid hoisting static import past jest.mock
const { auth } = require("@/auth") as { auth: jest.Mock };

jest.setTimeout(60000);

const SUFFIX = `grpb-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

let productId: number;
let variantId: number;

async function seedProductVariant() {
    const product = await prisma.product.create({
        data: {
            name: `GRPB-PRODUCT-${SUFFIX}`,
            slug: `grpb-product-${SUFFIX}`,
            category: "test",
        },
    });
    const variant = await prisma.productVariant.create({
        data: {
            productId: product.id,
            name: `Variant ${SUFFIX}`,
            price: 100000,
            stock: 999,
        },
    });
    return { product, variant };
}

async function seedShippingDiscount(
    opts: {
        code?: string;
        quota?: number | null;
        maxUsagePerUser?: number | null;
        type?: "FIXED" | "PERCENTAGE";
        value?: number;
    } = {}
) {
    const now = new Date();
    const discount = await prisma.shippingDiscount.create({
        data: {
            name: `GRPB-ONGKIR-${SUFFIX}`,
            code: opts.code ?? `${SUFFIX}`,
            type: opts.type ?? "FIXED",
            value: opts.value ?? 10000,
            quota: opts.quota ?? null,
            maxUsagePerUser: opts.maxUsagePerUser ?? null,
            startAt: new Date(now.getTime() - 1000),
            endAt: new Date(now.getTime() + 3600_000),
            isActive: true,
        },
    });
    return discount;
}

describe("Group B remediation (F1/F2 bulk tiers, F9 shipping quota)", () => {
    beforeAll(async () => {
        const seeded = await seedProductVariant();
        productId = seeded.product.id;
        variantId = seeded.variant.id;
    });

    afterAll(async () => {
        // Undo F9 seeded data via raw SQL (no FK cycles to worry:
        // shippingdiscount has no inbound FKs except `order`).
        await prisma.bulkDiscount.deleteMany({
            where: {
                OR: [
                    { productId },
                    { variantId },
                ],
            },
        });
        const shippingRows = await prisma.shippingDiscount.findMany({
            where: { name: `GRPB-ONGKIR-${SUFFIX}` },
            select: { id: true },
        });
        if (shippingRows.length) {
            // Clear order references first, then delete rows.
            await prisma.order.updateMany({
                where: { shippingDiscountId: { in: shippingRows.map((r) => r.id) } },
                data: { shippingDiscountId: null },
            });
            await prisma.shippingDiscount.deleteMany({
                where: { id: { in: shippingRows.map((r) => r.id) } },
            });
        }
        await prisma.productVariant.delete({ where: { id: variantId } });
        await prisma.product.delete({ where: { id: productId } });
    });

    describe("F1/F2 — bulk discount qualifying-tier selection", () => {
        afterEach(async () => {
            // Each test seeds its own tier set; keep them isolated.
            await prisma.bulkDiscount.deleteMany({
                where: {
                    OR: [{ productId }, { variantId }],
                },
            });
        });

        it("applies the highest qualifying variant tier (minQuantity <= quantity)", async () => {
            await prisma.bulkDiscount.createMany({
                data: [
                    {
                        productId,
                        variantId: null,
                        name: `GRPB-BULK-B3-${SUFFIX}`,
                        minQuantity: 3,
                        type: "PERCENTAGE",
                        value: 10,
                        startAt: new Date(Date.now() - 1000),
                        endAt: new Date(Date.now() + 3600_000),
                        isActive: true,
                    },
                    {
                        productId,
                        variantId: null,
                        name: `GRPB-BULK-B8-${SUFFIX}`,
                        minQuantity: 8,
                        type: "PERCENTAGE",
                        value: 25,
                        startAt: new Date(Date.now() - 1000),
                        endAt: new Date(Date.now() + 3600_000),
                        isActive: true,
                    },
                ],
            });

            // Quantity 3 → only the minQuantity-3 tier qualifies → 10%.
            const qty3 = (
                await resolveBatchPrices([
                    {
                        productId,
                        variantId,
                        originalPrice: 100000,
                        quantity: 3,
                    },
                ])
            )[0];

            expect(qty3.source).toBe("BULK_DISCOUNT");
            expect(qty3.effectivePrice).toBe(90000);
            expect(qty3.discountAmount).toBe(10000);

            // Quantity 8 → 25% tier qualifies → 25%.
            const qty8 = (
                await resolveBatchPrices([
                    {
                        productId,
                        variantId,
                        originalPrice: 100000,
                        quantity: 8,
                    },
                ])
            )[0];

            expect(qty8.source).toBe("BULK_DISCOUNT");
            expect(qty8.effectivePrice).toBe(75000);
            expect(qty8.discountAmount).toBe(25000);
        });

        it("falls back from a non-qualifying variant tier to a qualifying product tier", async () => {
            // Variant-level tier only for quantity >= 8.
            await prisma.bulkDiscount.create({
                data: {
                    productId,
                    variantId,
                    name: `GRPB-BULK-V8-${SUFFIX}`,
                    minQuantity: 8,
                    type: "PERCENTAGE",
                    value: 30,
                    startAt: new Date(Date.now() - 1000),
                    endAt: new Date(Date.now() + 3600_000),
                    isActive: true,
                },
            });

            // Product-level tier for quantity >= 2 (5%).
            await prisma.bulkDiscount.create({
                data: {
                    productId,
                    variantId: null,
                    name: `GRPB-BULK-P2-${SUFFIX}`,
                    minQuantity: 2,
                    type: "PERCENTAGE",
                    value: 5,
                    startAt: new Date(Date.now() - 1000),
                    endAt: new Date(Date.now() + 3600_000),
                    isActive: true,
                },
            });

            // Quantity 4: variant tier (min 8) does NOT qualify,
            // product tier (min 2) does → 5% from product tier.
            const qty4 = (
                await resolveBatchPrices([
                    {
                        productId,
                        variantId,
                        originalPrice: 100000,
                        quantity: 4,
                    },
                ])
            )[0];

            expect(qty4.source).toBe("BULK_DISCOUNT");
            expect(qty4.effectivePrice).toBe(95000);
            expect(qty4.discountAmount).toBe(5000);
        });
    });

    describe("F9 — shipping-discount quota reservation (CAS)", () => {
        it("reserves exactly one slot and rejects when quota is exhausted", async () => {
            const discount = await seedShippingDiscount({
                code: `GRPB-CAS-${SUFFIX}`,
                quota: 1,
            });

            await prisma.$transaction(async (tx) => {
                const first = await reserveShippingDiscountUsage(tx, discount.id);
                expect(first).toBe(true);
            });

            const second = await prisma.$transaction(async (tx) =>
                reserveShippingDiscountUsage(tx, discount.id)
            );
            expect(second).toBe(false);

            // Release frees the slot again.
            await prisma.$transaction(async (tx) => {
                await releaseShippingDiscountUsage(tx, discount.id);
            });

            await prisma.$transaction(async (tx) => {
                const third = await reserveShippingDiscountUsage(tx, discount.id);
                expect(third).toBe(true);
            });
        });

        it("returns null from calculateShippingDiscount once quota is exhausted", async () => {
            const discount = await seedShippingDiscount({
                code: `GRPB-QEX-${SUFFIX}`,
                quota: 1,
            });

            // Not yet exhausted → discount applies.
            const before = await calculateShippingDiscount(
                25000,
                100000,
                `GRPB-QEX-${SUFFIX}`
            );
            expect(before).not.toBeNull();

            // Exhaust the quota (CAS) …
            await prisma.$transaction(async (tx) => {
                await reserveShippingDiscountUsage(tx, discount.id);
            });

            // Lookup uses `code`, but the code differs between the
            // seeded instances in the same suite — re-fetch via the
            // explicit code we seeded.
            const exhausted = await calculateShippingDiscount(
                25000,
                100000,
                `GRPB-QEX-${SUFFIX}`
            );
            expect(exhausted).toBeNull();
        });
    });

    describe("F4/C — cart validates flash-sale stock", () => {
        let saleId: number;

        beforeAll(async () => {
            // Variant holds plenty of regular stock.
            await prisma.productVariant.update({
                where: { id: variantId },
                data: { stock: 100 },
            });

            const sale = await prisma.flashSale.create({
                data: {
                    productId,
                    variantId,
                    name: `GRPB-FS-${SUFFIX}`,
                    salePrice: 80000,
                    saleStock: 3,
                    startAt: new Date(Date.now() - 1000),
                    endAt: new Date(Date.now() + 3600_000),
                    isActive: true,
                },
            });
            saleId = sale.id;

            auth.mockResolvedValue({
                user: { id: `grpb-cart-${SUFFIX}` },
            });

            await prisma.user.create({
                data: {
                    id: `grpb-cart-${SUFFIX}`,
                    name: `GRPB-CART-${SUFFIX}`,
                    email: `grpb-cart-${SUFFIX}@p0test.local`,
                    phone: `999${Date.now()}`.slice(0, 17),
                },
            });
        });

        afterAll(async () => {
            await prisma.cartItem.deleteMany({
                where: {
                    cart: { userId: `grpb-cart-${SUFFIX}` },
                },
            });
            await prisma.cart.deleteMany({
                where: { userId: `grpb-cart-${SUFFIX}` },
            });
            await prisma.flashSalePurchase.deleteMany({
                where: { userId: `grpb-cart-${SUFFIX}` },
            });
            await prisma.flashSale.delete({
                where: { id: saleId },
            });
            await prisma.user.delete({
                where: { id: `grpb-cart-${SUFFIX}` },
            });
        });

        it("rejects adding more than the flash sale stock even though variant.stock is higher", async () => {
            const res = await cartPOST(
                new Request("http://localhost/api/cart", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        variantId,
                        quantity: 5,
                    }),
                })
            );

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.message).toContain("flash sale");
        });

        it("adds a quantity within the flash sale stock", async () => {
            const res = await cartPOST(
                new Request("http://localhost/api/cart", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        variantId,
                        quantity: 2,
                    }),
                })
            );

            expect(res.status).toBe(201);
        });
    });
});