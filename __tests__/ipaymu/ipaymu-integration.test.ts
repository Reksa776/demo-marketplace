/**
 * ==========================================
 * iPaymu Integration Tests
 * ==========================================
 *
 * Tests for:
 * - Signature generation
 * - Status mapping functions
 * - Amount verification
 * - Payment creation flow
 * - Webhook handling
 * - Integration with checkout flow
 */

import { readFileSync } from "fs";
import { resolve } from "path";

/* ==========================================
 * HELPERS
 * ========================================== */

function readFile(
    relativePath: string
): string {
    return readFileSync(
        resolve(process.cwd(), relativePath),
        "utf-8"
    );
}

/* ==========================================
 * SIGNATURE GENERATION
 * ========================================== */

describe("iPaymu Signature Generation", () => {
    test("generateSignature produces correct HMAC-SHA256", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );

        const body =
            '{"product":["Test"],"qty":["1"],"price":["10000"],"amount":10000}';
        const va = "1179000899";
        const apiKey = "test-api-key-123";

        const sig = generateSignature(
            body,
            va,
            apiKey
        );

        // Should be a 64-char hex string (HMAC-SHA256)
        expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    test("generateSignature is deterministic", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );

        const body =
            '{"amount":50000}';
        const va = "1179000899";
        const apiKey = "key123";

        const sig1 = generateSignature(
            body,
            va,
            apiKey
        );
        const sig2 = generateSignature(
            body,
            va,
            apiKey
        );

        expect(sig1).toBe(sig2);
    });

    test("generateSignature changes with different bodies", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );

        const va = "1179000899";
        const apiKey = "key123";

        const sig1 = generateSignature(
            '{"amount":10000}',
            va,
            apiKey
        );
        const sig2 = generateSignature(
            '{"amount":20000}',
            va,
            apiKey
        );

        expect(sig1).not.toBe(sig2);
    });

    test("generateTimestamp produces YYYYMMDDHHmmss format", async () => {
        const { generateTimestamp } = await import(
            "@/lib/payment/ipaymu"
        );

        const ts = generateTimestamp();

        expect(ts).toMatch(/^\d{14}$/);
    });
});

/* ==========================================
 * STATUS MAPPING
 * ========================================== */

describe("iPaymu Status Mapping", () => {
    test("isSuccessNotification returns true for Status 200", async () => {
        const { isSuccessNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isSuccessNotification({ Status: 200 })
        ).toBe(true);
    });

    test("isSuccessNotification returns true for status 'berhasil'", async () => {
        const { isSuccessNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isSuccessNotification({
                status: "berhasil",
            })
        ).toBe(true);
    });

    test("isSuccessNotification returns false for Status 100", async () => {
        const { isSuccessNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isSuccessNotification({ Status: 100 })
        ).toBe(false);
    });

    test("isSuccessNotification returns false for status 'pending'", async () => {
        const { isSuccessNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isSuccessNotification({
                status: "pending",
            })
        ).toBe(false);
    });

    test("isPendingNotification returns true for Status 100-199", async () => {
        const { isPendingNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isPendingNotification({ Status: 100 })
        ).toBe(true);
        expect(
            isPendingNotification({ Status: 150 })
        ).toBe(true);
        expect(
            isPendingNotification({ Status: 199 })
        ).toBe(true);
    });

    test("isPendingNotification returns true for status 'pending'", async () => {
        const { isPendingNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isPendingNotification({
                status: "pending",
            })
        ).toBe(true);
    });

    test("isPendingNotification returns false for Status 200", async () => {
        const { isPendingNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isPendingNotification({ Status: 200 })
        ).toBe(false);
    });

    test("isFailedNotification returns true for Status >= 400", async () => {
        const { isFailedNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isFailedNotification({ Status: 400 })
        ).toBe(true);
        expect(
            isFailedNotification({ Status: 500 })
        ).toBe(true);
    });

    test("isFailedNotification returns true for status 'gagal'", async () => {
        const { isFailedNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isFailedNotification({
                status: "gagal",
            })
        ).toBe(true);
    });

    test("isFailedNotification returns true for status 'expired'", async () => {
        const { isFailedNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isFailedNotification({
                status: "expired",
            })
        ).toBe(true);
    });

    test("isFailedNotification returns false for Status 200", async () => {
        const { isFailedNotification } =
            await import("@/lib/payment/ipaymu");

        expect(
            isFailedNotification({ Status: 200 })
        ).toBe(false);
    });
});

/* ==========================================
 * AMOUNT VERIFICATION
 * ========================================== */

describe("iPaymu Amount Verification", () => {
    test("verifyNotificationAmount returns true for matching Amount", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        expect(
            verifyNotificationAmount(
                { Amount: "100000" },
                100000
            )
        ).toBe(true);
    });

    test("verifyNotificationAmount returns true for numeric Amount", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        expect(
            verifyNotificationAmount(
                { Amount: 100000 },
                100000
            )
        ).toBe(true);
    });

    test("verifyNotificationAmount returns false for mismatched Amount", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        expect(
            verifyNotificationAmount(
                { Amount: "99999" },
                100000
            )
        ).toBe(false);
    });

    test("verifyNotificationAmount returns false for missing amount", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        expect(
            verifyNotificationAmount({}, 100000)
        ).toBe(false);
    });

    test("verifyNotificationAmount prefers sub_total over Amount", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        /* sub_total = 49500 (matches order.total)
         * Amount = 50391 (includes fee, does NOT match)
         */
        expect(
            verifyNotificationAmount(
                { sub_total: "49500", Amount: "50391" },
                49500
            )
        ).toBe(true);
    });

    test("verifyNotificationAmount rejects when sub_total mismatches", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        expect(
            verifyNotificationAmount(
                { sub_total: "49500", Amount: "50391" },
                99999
            )
        ).toBe(false);
    });

    test("verifyNotificationAmount works with real iPaymu webhook payload", async () => {
        const { verifyNotificationAmount } =
            await import("@/lib/payment/ipaymu");

        /* Real iPaymu sandbox payload:
         * sub_total = 49500, amount = 50391, fee = 4891
         * Order total = 49500
         */
        expect(
            verifyNotificationAmount(
                {
                    sub_total: "49500",
                    total: "50391",
                    amount: "50391",
                    fee: "4891",
                },
                49500
            )
        ).toBe(true);
    });
});

/* ==========================================
 * PAYMENT METHOD MAPPING
 * ========================================== */

describe("iPaymu Payment Method Mapping", () => {
    test("mapPaymentMethod maps 'qris' to QRIS", async () => {
        const { mapPaymentMethod } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            mapPaymentMethod("qris", "qris")
        ).toBe("QRIS");
    });

    test("mapPaymentMethod maps 'va' to BANK_TRANSFER", async () => {
        const { mapPaymentMethod } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            mapPaymentMethod("va", "bca")
        ).toBe("BANK_TRANSFER");
    });

    test("mapPaymentMethod maps 'banktransfer' to BANK_TRANSFER", async () => {
        const { mapPaymentMethod } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            mapPaymentMethod("banktransfer", "bca")
        ).toBe("BANK_TRANSFER");
    });
});

/* ==========================================
 * PRODUCT NAME FORMATTING
 * ==========================================
 *
 * Regression tests for the trailing
 * separator bug that caused iPaymu 401.
 */

describe("iPaymu Product Name Formatting", () => {
    test("formatProductName returns 'Product - Variant' when variant is available", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            formatProductName("Produk A", "Merah")
        ).toBe("Produk A - Merah");
    });

    test("formatProductName returns only productName when variant is empty string", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            formatProductName("Produk A", "")
        ).toBe("Produk A");
    });

    test("formatProductName returns only productName when variant is null", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            formatProductName("Produk A", null)
        ).toBe("Produk A");
    });

    test("formatProductName returns only productName when variant is undefined", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        expect(
            formatProductName("Produk A")
        ).toBe("Produk A");
    });

    test("formatProductName has no trailing whitespace", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        const result = formatProductName(
            "Produk A",
            ""
        );
        expect(result).not.toMatch(/\s$/);
        expect(result).not.toMatch(/-\s*$/);
    });

    test("formatProductName has no trailing separator when variant is undefined", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        const result = formatProductName(
            "Produk A"
        );
        expect(result).not.toMatch(/-\s*$/);
    });

    test("formatProductName handles long product names with variant", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        const result = formatProductName(
            "Kripik Kue Kuping Gajah Cream 1KG Mutiara Abadi",
            "Pedas"
        );
        expect(result).toBe(
            "Kripik Kue Kuping Gajah Cream 1KG Mutiara Abadi - Pedas"
        );
    });

    test("formatProductName handles long product name without variant", async () => {
        const { formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        const result = formatProductName(
            "Kripik Kue Kuping Gajah Cream 1KG Mutiara Abadi"
        );
        expect(result).toBe(
            "Kripik Kue Kuping Gajah Cream 1KG Mutiara Abadi"
        );
        expect(result).not.toMatch(/-\s*$/);
    });

    test("formatProductName does not break signature generation", async () => {
        const { generateSignature, formatProductName } = await import(
            "@/lib/payment/ipaymu"
        );

        const name = formatProductName(
            "Produk A",
            ""
        );
        expect(name).toBe("Produk A");

        // Signature should be deterministic for the same body
        const body = JSON.stringify({
            product: [name, "Biaya Pengiriman"],
            qty: ["1", "1"],
            price: ["10000", "5000"],
            amount: 15000,
        });

        const sig = generateSignature(
            body,
            "1179000899",
            "test-key"
        );

        // Same body → same signature
        expect(
            generateSignature(body, "1179000899", "test-key")
        ).toBe(sig);
    });
});

/* ==========================================
 * INTEGRATION WITH CHECKOUT FLOW
 * ========================================== */

describe("iPaymu Checkout Integration", () => {
    test("iPaymu buy-now route uses formatProductName (no trailing separator)", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain("formatProductName");
        expect(route).not.toMatch(/\$\{item\.productName\} - \$\{item\.variantName\}/);
    });

    test("iPaymu cart route uses formatProductName (no trailing separator)", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain("formatProductName");
        expect(route).not.toMatch(/\$\{item\.productName\} - \$\{item\.variantName\}/);
    });

    test("iPaymu cart route uses createCheckoutOrder", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain(
            "createCheckoutOrder"
        );
    });

    test("iPaymu buy-now route uses createCheckoutOrder", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain(
            "createCheckoutOrder"
        );
    });

    test("iPaymu cart route calls createRedirectPayment", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain(
            "createRedirectPayment"
        );
    });

    test("iPaymu buy-now route calls createRedirectPayment", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain(
            "createRedirectPayment"
        );
    });

    test("iPaymu cart route returns paymentUrl", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain("paymentUrl");
    });

    test("iPaymu buy-now route returns paymentUrl", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain("paymentUrl");
    });

    test("iPaymu cart route imports rateLimiters", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain(
            "rateLimiters.orderCreation"
        );
    });

    test("iPaymu buy-now route imports rateLimiters", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain(
            "rateLimiters.orderCreation"
        );
    });

    test("iPaymu cart route handles rollback on failure", () => {
        const route = readFile(
            "app/api/payment/ipaymu/route.ts"
        );

        expect(route).toContain(
            "rollbackCheckoutOrder"
        );
    });

    test("iPaymu buy-now route handles rollback on failure", () => {
        const route = readFile(
            "app/api/buy-now/ipaymu/route.ts"
        );

        expect(route).toContain(
            "rollbackCheckoutOrder"
        );
    });
});

/* ==========================================
 * WEBHOOK INTEGRATION
 * ========================================== */

describe("iPaymu Webhook Integration", () => {
    test("webhook uses atomic CAS update for settlement", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain("$executeRaw");
        expect(webhook).toContain(
            "paymentStatus NOT IN ('PAID', 'REFUNDED')"
        );
    });

    test("webhook handles failed/expired with stock release", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "releaseStockAndVoucherForOrder"
        );
    });

    test("webhook handles affiliate commission cancellation", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "cancelCommissionForOrder"
        );
    });

    test("webhook clears cart for CART orders on success", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "PAY-CART-"
        );
        expect(webhook).toContain(
            "cartItem.deleteMany"
        );
    });

    test("webhook validates amount matches order", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "verifyNotificationAmount"
        );
    });

    test("webhook sends notification on status change", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "onOrderStatusChanged"
        );
    });

    test("webhook returns 500 on error for provider retry", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "500"
        );
    });

    test("webhook parses URL-encoded body (not JSON)", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "URLSearchParams"
        );
        expect(webhook).toContain(
            "request.text()"
        );
        expect(webhook).not.toContain(
            "request.json()"
        );
    });

    test("webhook maps reference_id to ReferenceId", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "raw.reference_id"
        );
        expect(webhook).toContain(
            "ReferenceId"
        );
    });

    test("webhook maps sid to SessionId", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain("raw.sid");
        expect(webhook).toContain(
            "SessionId"
        );
    });

    test("webhook maps trx_id to TransactionId", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain("raw.trx_id");
        expect(webhook).toContain(
            "TransactionId"
        );
    });

    test("webhook maps status_code 1 to Status 200 (success)", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain("status_code");
        expect(webhook).toContain(
            "=== 1"
        );
        expect(webhook).toContain(
            "? 200"
        );
    });

    test("webhook logs iPaymu-specific fields", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).toContain(
            "reference_id"
        );
        expect(webhook).toContain("trx_id");
        expect(webhook).toContain("sub_total");
        expect(webhook).toContain(
            "settlement_status"
        );
    });

    test("webhook does not log API key or credentials", () => {
        const webhook = readFile(
            "app/api/payment/ipaymu/notification/route.ts"
        );

        expect(webhook).not.toMatch(
            /console\.log.*apiKey/i
        );
        expect(webhook).not.toMatch(
            /console\.log.*API_KEY/i
        );
        expect(webhook).not.toMatch(
            /console\.log.*secret/i
        );
    });
});

/* ==========================================
 * UI INTEGRATION
 * ========================================== */

describe("iPaymu UI Integration", () => {
    test("CheckoutPage calls /api/payment/ipaymu instead of midtrans", () => {
        const checkout = readFile(
            "app/checkout/CheckoutPage.tsx"
        );

        expect(checkout).toContain(
            "/api/payment/ipaymu"
        );
        expect(checkout).not.toContain(
            "/api/payment/midtrans"
        );
    });

    test("CheckoutPage uses redirect (window.location.href) instead of snap.pay", () => {
        const checkout = readFile(
            "app/checkout/CheckoutPage.tsx"
        );

        expect(checkout).toContain(
            "window.location.href ="
        );
        expect(checkout).not.toContain(
            "window.snap.pay"
        );
    });

    test("CheckoutPage reads paymentUrl from response", () => {
        const checkout = readFile(
            "app/checkout/CheckoutPage.tsx"
        );

        expect(checkout).toContain("paymentUrl");
    });

    test("BuyNowPage calls /api/buy-now/ipaymu instead of midtrans", () => {
        const buyNow = readFile(
            "app/buy-now/BuyNowPage.tsx"
        );

        expect(buyNow).toContain(
            "/api/buy-now/ipaymu"
        );
        expect(buyNow).not.toContain(
            "/api/buy-now/midtrans"
        );
    });

    test("BuyNowPage uses redirect instead of snap.pay", () => {
        const buyNow = readFile(
            "app/buy-now/BuyNowPage.tsx"
        );

        expect(buyNow).toContain(
            "window.location.href ="
        );
        expect(buyNow).not.toContain(
            "snap.pay("
        );
    });

    test("Layout no longer loads Midtrans Snap.js", () => {
        const layout = readFile("app/layout.tsx");

        expect(layout).not.toContain(
            "snap.js"
        );
        expect(layout).not.toContain(
            "midtrans.com"
        );
        expect(layout).not.toContain(
            "sandbox.midtrans.com"
        );
    });
});

/* ==========================================
 * PAYMENT PROVIDER INDEPENDENCE
 * ========================================== */

describe("iPaymu Provider Independence", () => {
    test("Affiliate payout still uses Midtrans Iris (unchanged)", () => {
        const payout = readFile(
            "lib/affiliate/payout-provider.ts"
        );

        expect(payout).toContain("Midtrans Iris");
        expect(payout).toContain("PAYOUT_API_KEY");
        expect(payout).toContain(
            "api.midtrans.com"
        );
    });

    test("Checkout lib shared logic unchanged", () => {
        const checkout = readFile("lib/checkout.ts");

        // Shared functions still exist
        expect(checkout).toContain(
            "createCheckoutOrder"
        );
        expect(checkout).toContain(
            "rollbackCheckoutOrder"
        );
        expect(checkout).toContain(
            "getEnabledPayments"
        );
    });

    test("Order model fields are provider-agnostic", () => {
        const schema = readFile(
            "prisma/schema.prisma"
        );

        expect(schema).toContain(
            "paymentReference"
        );
        expect(schema).toContain("paymentStatus");
        expect(schema).not.toContain(
            "midtransTransactionId"
        );
        expect(schema).not.toContain("snapToken");
    });
});
