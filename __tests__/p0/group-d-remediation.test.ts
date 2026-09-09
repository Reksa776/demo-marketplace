/**
 * ==========================================
 * GROUP D REMEDIATION — BEHAVIORAL TESTS (real MariaDB)
 * ==========================================
 *
 * Coverage:
 *   F21  Admin order PATCH is a compare-and-swap on EVERY status
 *        transition (TOCTOU race) and returns 409 on conflict.
 *   F9   Admin cancel releases the reserved shipping-discount quota.
 *   F17  Payout webhook verification fails CLOSED when the secret
 *        is not configured (no more dev-mode accept-all).
 *   F16  Payout webhook does not settle on amount mismatch; a valid
 *        signed callback for the correct amount still settles.
 *
 * All seeded rows use a unique suffix and are removed in afterAll.
 */

jest.mock("@/auth", () => ({
    auth: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { createShippingDiscount } from "@/lib/marketing/shipping-discount";
import { PATCH as adminOrderPATCH } from "@/app/api/admin/orders/[id]/route";
import { auth } from "@/auth";

jest.setTimeout(60000);

const SUFFIX = `grpd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const PAYOUT_SECRET = "grpd-f17-test-secret";

process.env.PAYOUT_SECRET_KEY = PAYOUT_SECRET;
process.env.PAYOUT_API_KEY = "grpd-test";

// The payout webhook route (and the provider config it imports) reads
// the env at module load, so it MUST be required AFTER the secret is
// set above.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- env-dependent dynamic load, see comment above
const { POST: payoutWebhookPOST } = require("@/app/api/payment/payout/webhook/route") as {
    POST: (req: Request) => Promise<Response>;
};

beforeEach(() => {
    (auth as jest.Mock).mockResolvedValue({
        user: { id: "admin-grpd", role: "ADMIN" },
    });
});

async function seedUser(role: "CUSTOMER" = "CUSTOMER") {
    return prisma.user.create({
        data: {
            id: `${SUFFIX}-${Math.random().toString(36).slice(2, 7)}`,
            name: `GRPD-${role}`,
            email: `${Math.random().toString(36).slice(2, 9)}@grpd.local`,
            phone: `999${Date.now()}`.slice(0, 17),
            role,
        },
    });
}

async function seedOrder(
    userId: string,
    status: "PENDING" | "PROCESSING" | "PAID"
) {
    const total = 100000;
    return prisma.order.create({
        data: {
            userId,
            orderNumber: `GRPD-ORD-${SUFFIX}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            recipientName: "GRPD Test",
            phone: "08120000",
            address: "Jl. Test",
            subtotal: new Prisma.Decimal(total - 10000),
            shippingCost: new Prisma.Decimal(10000),
            total: new Prisma.Decimal(total),
            discount: new Prisma.Decimal(0),
            status,
            paymentMethod: "BANK_TRANSFER",
            paymentStatus: "PENDING",
        },
    });
}

function adminPatch(orderId: number, body: { status: string }) {
    return adminOrderPATCH(
        new Request(`http://localhost/api/admin/orders/${orderId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: String(orderId) }) }
    );
}

function signPayoutBody(payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    const signature = crypto
        .createHmac("sha512", PAYOUT_SECRET)
        .update(body)
        .digest("hex");
    return { body, signature };
}

describe("F21 — admin order transitions are CAS + release shipping quota", () => {
    let userId: string;
    const orders: number[] = [];

    afterAll(async () => {
        await prisma.order.deleteMany({
            where: { id: { in: orders } },
        });
        if (userId) {
            await prisma.user.deleteMany({ where: { id: userId } });
        }
    });

    it("applies a valid transition (sanity)", async () => {
        const user = await seedUser();
        userId = user.id;
        const order = await seedOrder(user.id, "PENDING");
        orders.push(order.id);

        const res = await adminPatch(order.id, { status: "PROCESSING" });
        expect(res.status).toBe(200);

        const after = await prisma.order.findUnique({
            where: { id: order.id },
        });
        expect(after?.status).toBe("PROCESSING");
    });

    it("returns 409 when the row changed between read and write (TOCTOU)", async () => {
        const user = await seedUser();
        const order = await seedOrder(user.id, "PENDING");
        orders.push(order.id);

        // Deterministic race simulation: the route reads PENDING, then a
        // concurrent request flips the row to PAID BEFORE the CAS write.
        const originalFindUnique = prisma.order.findUnique.bind(prisma.order);
        const spy = jest.spyOn(prisma.order, "findUnique") as jest.SpyInstance;
        spy.mockImplementationOnce(async (args: {
            where: { id: number };
        }) => {
            const result = await originalFindUnique(args);
            if (
                result &&
                result.id === order.id &&
                result.status === "PENDING"
            ) {
                await prisma.$executeRaw`
                    UPDATE \`order\`
                    SET status = 'PAID'
                    WHERE id = ${order.id}
                      AND status = 'PENDING'
                `;
            }
            return result;
        });

        const res = await adminPatch(order.id, { status: "PROCESSING" });
        spy.mockRestore();

        expect(res.status).toBe(409);

        const after = await prisma.order.findUnique({
            where: { id: order.id },
        });
        expect(after?.status).toBe("PAID");
    });

    it("releases reserved shipping-discount quota on admin cancel", async () => {
        const user = await seedUser();
        const discount = await createShippingDiscount({
            name: `GRPD-SD-${SUFFIX}`,
            type: "PERCENTAGE",
            value: 20,
            startAt: new Date(Date.now() - 1000),
            endAt: new Date(Date.now() + 3600_000),
        });
        await prisma.shippingDiscount.update({
            where: { id: discount.id },
            data: { usedCount: 1 },
        });

        const order = await prisma.order.create({
            data: {
                userId: user.id,
                orderNumber: `GRPD-ORD-${SUFFIX}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                recipientName: "GRPD Test",
                phone: "08120000",
                address: "Jl. Test",
                subtotal: new Prisma.Decimal(90000),
                shippingCost: new Prisma.Decimal(10000),
                total: new Prisma.Decimal(100000),
                discount: new Prisma.Decimal(0),
                shippingDiscountId: discount.id,
                status: "PENDING",
                paymentMethod: "BANK_TRANSFER",
                paymentStatus: "PENDING",
            },
        });
        orders.push(order.id);

        const res = await adminPatch(order.id, { status: "CANCELLED" });
        expect(res.status).toBe(200);

        const afterDiscount = await prisma.shippingDiscount.findUnique({
            where: { id: discount.id },
        });
        expect(afterDiscount?.usedCount).toBe(0);

        const afterOrder = await prisma.order.findUnique({
            where: { id: order.id },
        });
        expect(afterOrder?.status).toBe("CANCELLED");

        await prisma.shippingDiscount.delete({
            where: { id: discount.id },
        });
    });
});

describe("F17/F16 — payout webhook integrity", () => {
    let affiliateUserId: string;
    let affiliateProfileId: number;
    let payoutIds: number[] = [];

    beforeEach(async () => {
        const user = await seedUser();
        affiliateUserId = user.id;
        const profile = await prisma.affiliateProfile.create({
            data: {
                userId: user.id,
                affiliateCode: `GRPD-${Math.random().toString(36).slice(2, 8)}`,
                commissionRate: new Prisma.Decimal(5),
            },
        });
        affiliateProfileId = profile.id;
    });

    afterEach(async () => {
        await prisma.affiliatePayout.deleteMany({
            where: { id: { in: payoutIds } },
        });
        payoutIds = [];
        await prisma.affiliateProfile.deleteMany({
            where: { id: affiliateProfileId },
        });
        if (affiliateUserId) {
            await prisma.user.deleteMany({ where: { id: affiliateUserId } });
        }
    });

    it("rejects a signed callback whose amount does not match the payout (F16)", async () => {
        const payout = await prisma.affiliatePayout.create({
            data: {
                affiliateId: affiliateProfileId,
                amount: new Prisma.Decimal(50000),
                status: "PROCESSING",
                bankName: "BCA",
                bankAccountName: "GRPD",
                bankAccountNumber: "1234567890",
                providerReference: `GRPD-REF-${SUFFIX}`,
            },
        });
        payoutIds.push(payout.id);

        const { body, signature } = signPayoutBody({
            reference_id: `GRPD-REF-${SUFFIX}`,
            status: "success",
            amount: 50001,
        });

        const res = await payoutWebhookPOST(
            new Request("http://localhost/api/payment/payout/webhook", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-signature": signature,
                },
                body,
            })
        );
        expect(res.status).toBe(400);

        const after = await prisma.affiliatePayout.findUnique({
            where: { id: payout.id },
        });
        expect(after?.status).toBe("PROCESSING");
    });

    it("settles a valid signed callback with matching amount (F16/F17)", async () => {
        const payout = await prisma.affiliatePayout.create({
            data: {
                affiliateId: affiliateProfileId,
                amount: new Prisma.Decimal(75000),
                status: "PROCESSING",
                bankName: "BCA",
                bankAccountName: "GRPD",
                bankAccountNumber: "1234567890",
                providerReference: `GRPD-REF2-${SUFFIX}`,
            },
        });
        payoutIds.push(payout.id);

        const { body, signature } = signPayoutBody({
            reference_id: `GRPD-REF2-${SUFFIX}`,
            status: "success",
            amount: 75000,
        });

        const res = await payoutWebhookPOST(
            new Request("http://localhost/api/payment/payout/webhook", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-signature": signature,
                },
                body,
            })
        );
        expect(res.status).toBe(200);

        const after = await prisma.affiliatePayout.findUnique({
            where: { id: payout.id },
        });
        expect(after?.status).toBe("PAID");
        expect(after?.providerStatus).toBe("success");
    });

    it("rejects webhooks when the secret is not configured (F17 fail-closed)", () => {
        const prevSecret = process.env.PAYOUT_SECRET_KEY;
        const prevApi = process.env.PAYOUT_API_KEY;
        delete process.env.PAYOUT_SECRET_KEY;
        delete process.env.PAYOUT_API_KEY;

        jest.isolateModules(() => {
            // Force a fresh module graph so `config` re-reads the env.
            const {
                verifyWebhookSignature,
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- required inside isolateModules for fresh module graph
            } = require("@/lib/affiliate/payout-provider");
            expect(
                verifyWebhookSignature(
                    '{"status":"success"}',
                    "deadbeef"
                )
            ).toBe(false);
            expect(verifyWebhookSignature('{"status":"success"}', "")).toBe(
                false
            );
        });

        if (prevSecret) process.env.PAYOUT_SECRET_KEY = prevSecret;
        if (prevApi) process.env.PAYOUT_API_KEY = prevApi;
    });
});