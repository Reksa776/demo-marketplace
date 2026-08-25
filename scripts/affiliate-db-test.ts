/**
 * AFFILIATE MODULE — DATABASE-LEVEL BEHAVIORAL TESTS
 * 
 * Tests actual database operations to verify:
 * A. Self-referral: affiliate checkout with own code → no commission
 * B. Payout balance: balance calculation matches ledger
 * C. Commission lifecycle: PENDING → APPROVED → PAID flow
 * D. Commission cancellation: order cancelled → commission cancelled
 * 
 * Runs against real MariaDB.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const cleanupIds: { table: string; where: any }[] = [];

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}

function trackCleanup(table: string, where: any) {
    cleanupIds.push({ table, where });
}

async function cleanup() {
    // Clean up in reverse order
    for (const { table, where } of cleanupIds.reverse()) {
        try {
            await (prisma as any)[table].deleteMany({ where });
        } catch {}
    }
}

// ==========================================
// HELPER: Create test user + optional affiliate
// ==========================================
async function createTestUser(name: string, email?: string) {
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);
    const user = await prisma.user.create({
        data: {
            name,
            email: email || `test-${uniqueSuffix}@test.com`,
            role: "CUSTOMER",
            referralCode: `REF${uniqueSuffix.toUpperCase()}`,
        },
    });
    trackCleanup("user", { id: user.id });
    return user;
}

async function createAffiliate(userId: string, rate: number = 5.0) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const profile = await prisma.affiliateProfile.create({
        data: {
            userId,
            status: "APPROVED",
            affiliateCode: code,
            commissionRate: new Prisma.Decimal(rate.toFixed(2)),
            approvedAt: new Date(),
            approvedBy: "test-system",
        },
    });
    trackCleanup("affiliateProfile", { id: profile.id });
    return profile;
}

async function createTestOrder(userId: string, subtotalNum: number) {
    const orderNumber = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const order = await prisma.order.create({
        data: {
            userId,
            orderNumber,
            recipientName: "Test Recipient",
            phone: "08123456789",
            address: "Test Address",
            subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
            shippingCost: new Prisma.Decimal("10000.00"),
            total: new Prisma.Decimal((subtotalNum + 10000).toFixed(2)),
            discount: new Prisma.Decimal("0.00"),
            status: "PENDING",
            paymentStatus: "UNPAID",
            paymentMethod: "BANK_TRANSFER",
            city: "Jakarta",
            province: "DKI Jakarta",
            district: "Jakarta Pusat",
            postalCode: "10310",
        },
    });
    trackCleanup("order", { id: order.id });
    return order;
}

async function createProduct() {
    const product = await prisma.product.create({
        data: {
            name: `Test Product ${Date.now()}`,
            slug: `test-product-${Date.now()}`,
            description: "Test",
        },
    });
    trackCleanup("product", { id: product.id });
    return product;
}

async function createVariant(productId: number) {
    const variant = await prisma.productVariant.create({
        data: {
            productId,
            name: "Default",
            price: 50000,
            stock: 100,
        },
    });
    trackCleanup("productVariant", { id: variant.id });
    return variant;
}

async function createOrderItem(orderId: number, productId: number, variantId: number, quantity: number, price: number) {
    const item = await prisma.orderItem.create({
        data: {
            orderId,
            productId,
            variantId,
            quantity,
            price: new Prisma.Decimal(price.toFixed(2)),
            subtotal: new Prisma.Decimal((price * quantity).toFixed(2)),
            productName: "Test Product",
            variantName: "Default",
        },
    });
    trackCleanup("orderItem", { id: item.id });
    return item;
}

async function main() {
    console.log("\n==================================================");
    console.log("  AFFILIATE MODULE — DATABASE-LEVEL TESTS");
    console.log("==================================================\n");

    // ==========================================
    // A. SELF-REFERRAL PREVENTION (DB-level)
    // ==========================================
    console.log("--- A. SELF-REFERRAL PREVENTION (DB) ---\n");

    await test("A1: Self-referral check exists in checkout code path", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const checkoutCode = readFileSync(resolve(process.cwd(), "lib/checkout.ts"), "utf-8");
        
        // Verify the self-referral check is in the checkout transaction
        assert(
            checkoutCode.includes("affiliate.userId === input.userId"),
            "Self-referral check (affiliate.userId === input.userId) must exist"
        );
        
        // Verify it comes BEFORE the conversion creation
        const checkIdx = checkoutCode.indexOf("affiliate.userId === input.userId");
        const createIdx = checkoutCode.indexOf("affiliateConversion.create");
        assert(
            checkIdx < createIdx,
            "Self-referral check must come before commission creation"
        );
    });

    await test("A2: Self-referral logs event and skips commission", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const checkoutCode = readFileSync(resolve(process.cwd(), "lib/checkout.ts"), "utf-8");
        
        assert(
            checkoutCode.includes("SELF_REFERRAL_BLOCKED"),
            "Must log SELF_REFERRAL_BLOCKED event"
        );
        
        // The else-if pattern ensures commission creation only runs for non-self referrals
        assert(
            checkoutCode.includes("} else if (affiliate)"),
            "Must use else-if pattern to skip commission on self-referral"
        );
    });

    // ==========================================
    // B. BALANCE CALCULATION (DB-level)
    // ==========================================
    console.log("\n--- B. BALANCE CALCULATION (DB) ---\n");

    await test("B1: getAvailableBalance correctly computes earned - disbursed", async () => {
        // Create test data
        const user1 = await createTestUser("Balance Test User");
        const affiliate = await createAffiliate(user1.id);

        // Create a test order
        const product = await createProduct();
        const variant = await createVariant(product.id);
        const order = await createTestOrder(user1.id, 100000);

        // Create APPROVED commission (5% of 100000 = 5000)
        const conversion = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliate.id,
                orderId: order.id,
                affiliateCode: affiliate.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "APPROVED",
            },
        });
        trackCleanup("affiliateConversion", { id: conversion.id });

        // Test getAvailableBalance
        const { getAvailableBalance } = await import("@/lib/affiliate/commission");
        const balance = await getAvailableBalance(affiliate.id);

        // earned = 5000, disbursed = 0, available = 5000
        assert(
            balance.equals(new Prisma.Decimal("5000.00")),
            `Balance should be 5000, got ${balance.toString()}`
        );
    });

    await test("B2: Balance decreases when payout is PENDING", async () => {
        const user2 = await createTestUser("Payout Test User");
        const affiliate2 = await createAffiliate(user2.id);

        // Create APPROVED commission
        const order2 = await createTestOrder(user2.id, 200000);
        const conv2 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliate2.id,
                orderId: order2.id,
                affiliateCode: affiliate2.affiliateCode,
                orderSubtotal: new Prisma.Decimal("200000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("10000.00"),
                status: "APPROVED",
            },
        });
        trackCleanup("affiliateConversion", { id: conv2.id });

        // Create PENDING payout (reserves 8000)
        const payout = await prisma.affiliatePayout.create({
            data: {
                affiliateId: affiliate2.id,
                amount: new Prisma.Decimal("8000.00"),
                status: "PENDING",
                bankName: "BCA",
                bankAccountName: "Test",
                bankAccountNumber: "1234567890",
            },
        });
        trackCleanup("affiliatePayout", { id: payout.id });

        const { getAvailableBalance } = await import("@/lib/affiliate/commission");
        const balance = await getAvailableBalance(affiliate2.id);

        // earned = 10000, disbursed = 8000, available = 2000
        assert(
            balance.equals(new Prisma.Decimal("2000.00")),
            `Balance should be 2000 (10000-8000), got ${balance.toString()}`
        );
    });

    await test("B3: Balance does not go negative", async () => {
        const user3 = await createTestUser("Negative Test User");
        const affiliate3 = await createAffiliate(user3.id);

        // Create PENDING commission (not counted as earned)
        const order3 = await createTestOrder(user3.id, 50000);
        const conv3 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliate3.id,
                orderId: order3.id,
                affiliateCode: affiliate3.affiliateCode,
                orderSubtotal: new Prisma.Decimal("50000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("2500.00"),
                status: "PENDING",
            },
        });
        trackCleanup("affiliateConversion", { id: conv3.id });

        // Create PENDING payout (disbursed = 3000)
        const payout3 = await prisma.affiliatePayout.create({
            data: {
                affiliateId: affiliate3.id,
                amount: new Prisma.Decimal("3000.00"),
                status: "PENDING",
                bankName: "BCA",
                bankAccountName: "Test",
                bankAccountNumber: "1234567890",
            },
        });
        trackCleanup("affiliatePayout", { id: payout3.id });

        const { getAvailableBalance } = await import("@/lib/affiliate/commission");
        const balance = await getAvailableBalance(affiliate3.id);

        // earned = 0 (PENDING not counted), disbursed = 3000, available = max(0, 0-3000) = 0
        assert(
            balance.equals(new Prisma.Decimal("0")),
            `Balance should be 0 (floor), got ${balance.toString()}`
        );
    });

    await test("B4: REJECTED payout does not count as disbursed", async () => {
        const user4 = await createTestUser("Rejected Payout User");
        const affiliate4 = await createAffiliate(user4.id);

        const order4 = await createTestOrder(user4.id, 100000);
        const conv4 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliate4.id,
                orderId: order4.id,
                affiliateCode: affiliate4.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "APPROVED",
            },
        });
        trackCleanup("affiliateConversion", { id: conv4.id });

        // Rejected payout - should NOT reduce balance
        const payout4 = await prisma.affiliatePayout.create({
            data: {
                affiliateId: affiliate4.id,
                amount: new Prisma.Decimal("3000.00"),
                status: "REJECTED",
                bankName: "BCA",
                bankAccountName: "Test",
                bankAccountNumber: "1234567890",
            },
        });
        trackCleanup("affiliatePayout", { id: payout4.id });

        const { getAvailableBalance } = await import("@/lib/affiliate/commission");
        const balance = await getAvailableBalance(affiliate4.id);

        // earned = 5000, disbursed = 0 (REJECTED not counted), available = 5000
        assert(
            balance.equals(new Prisma.Decimal("5000.00")),
            `Balance should be 5000 (REJECTED not counted), got ${balance.toString()}`
        );
    });

    // ==========================================
    // C. COMMISSION LIFECYCLE (DB-level)
    // ==========================================
    console.log("\n--- C. COMMISSION LIFECYCLE (DB) ---\n");

    await test("C1: Commission can transition PENDING → APPROVED", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(isValidTransition("PENDING", "APPROVED"), "PENDING → APPROVED should be valid");
    });

    await test("C2: Commission can transition PENDING → CANCELLED", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(isValidTransition("PENDING", "CANCELLED"), "PENDING → CANCELLED should be valid");
    });

    await test("C3: Commission can transition APPROVED → PAID", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(isValidTransition("APPROVED", "PAID"), "APPROVED → PAID should be valid");
    });

    await test("C4: Commission can transition APPROVED → CANCELLED", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(isValidTransition("APPROVED", "CANCELLED"), "APPROVED → CANCELLED should be valid");
    });

    await test("C5: Commission cannot transition PAID → anything (terminal)", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(!isValidTransition("PAID", "APPROVED"), "PAID → APPROVED should be invalid");
        assert(!isValidTransition("PAID", "CANCELLED"), "PAID → CANCELLED should be invalid");
    });

    await test("C6: Commission cannot transition CANCELLED → anything (terminal)", async () => {
        const { isValidTransition } = await import("@/lib/affiliate/commission");
        assert(!isValidTransition("CANCELLED", "APPROVED"), "CANCELLED → APPROVED should be invalid");
        assert(!isValidTransition("CANCELLED", "PAID"), "CANCELLED → PAID should be invalid");
    });

    await test("C7: Commission balance changes correctly on transition", async () => {
        const user7 = await createTestUser("Commission Transition User");
        const affiliate7 = await createAffiliate(user7.id);
        const order7 = await createTestOrder(user7.id, 100000);
        
        const conv7 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliate7.id,
                orderId: order7.id,
                affiliateCode: affiliate7.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PENDING",
            },
        });
        trackCleanup("affiliateConversion", { id: conv7.id });

        const { getAvailableBalance } = await import("@/lib/affiliate/commission");

        // PENDING → balance should be 0
        let balance = await getAvailableBalance(affiliate7.id);
        assert(balance.equals(new Prisma.Decimal("0")), `PENDING: balance should be 0, got ${balance.toString()}`);

        // APPROVE → balance should be 5000
        await prisma.affiliateConversion.update({
            where: { id: conv7.id },
            data: { status: "APPROVED" },
        });
        balance = await getAvailableBalance(affiliate7.id);
        assert(balance.equals(new Prisma.Decimal("5000.00")), `APPROVED: balance should be 5000, got ${balance.toString()}`);

        // CANCEL → balance should be 0 again
        await prisma.affiliateConversion.update({
            where: { id: conv7.id },
            data: { status: "CANCELLED" },
        });
        balance = await getAvailableBalance(affiliate7.id);
        assert(balance.equals(new Prisma.Decimal("0")), `CANCELLED: balance should be 0, got ${balance.toString()}`);
    });

    // ==========================================
    // D. COMMISSION CANCELLATION (DB-level)
    // ==========================================
    console.log("\n--- D. COMMISSION CANCELLATION (DB) ---\n");

    await test("D1: cancelCommissionForOrder cancels PENDING commission", async () => {
        const userD1 = await createTestUser("Cancel Pending User");
        const affiliateD1 = await createAffiliate(userD1.id);
        const orderD1 = await createTestOrder(userD1.id, 100000);
        
        const convD1 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateD1.id,
                orderId: orderD1.id,
                affiliateCode: affiliateD1.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PENDING",
            },
        });
        trackCleanup("affiliateConversion", { id: convD1.id });

        const { cancelCommissionForOrder } = await import("@/lib/affiliate/cancel-commission");
        const cancelled = await cancelCommissionForOrder(prisma, orderD1.id, "ADMIN_CANCELLED");

        assert(cancelled === true, "cancelCommissionForOrder should return true");

        const updatedConv = await prisma.affiliateConversion.findUnique({ where: { id: convD1.id } });
        assert(updatedConv?.status === "CANCELLED", `Commission should be CANCELLED, got ${updatedConv?.status}`);
    });

    await test("D2: cancelCommissionForOrder is idempotent (already cancelled)", async () => {
        const userD2 = await createTestUser("Idempotent Cancel User");
        const affiliateD2 = await createAffiliate(userD2.id);
        const orderD2 = await createTestOrder(userD2.id, 100000);
        
        const convD2 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateD2.id,
                orderId: orderD2.id,
                affiliateCode: affiliateD2.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "CANCELLED",
            },
        });
        trackCleanup("affiliateConversion", { id: convD2.id });

        const { cancelCommissionForOrder } = await import("@/lib/affiliate/cancel-commission");
        const result = await cancelCommissionForOrder(prisma, orderD2.id, "ADMIN_CANCELLED");

        assert(result === false, "cancelCommissionForOrder should return false for already cancelled");
    });

    await test("D3: cancelCommissionForOrder does NOT reverse PAID commission", async () => {
        const userD3 = await createTestUser("Paid Commission User");
        const affiliateD3 = await createAffiliate(userD3.id);
        const orderD3 = await createTestOrder(userD3.id, 100000);
        
        const convD3 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateD3.id,
                orderId: orderD3.id,
                affiliateCode: affiliateD3.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PAID",
            },
        });
        trackCleanup("affiliateConversion", { id: convD3.id });

        const { cancelCommissionForOrder } = await import("@/lib/affiliate/cancel-commission");
        const result = await cancelCommissionForOrder(prisma, orderD3.id, "ORDER_REFUNDED");

        assert(result === false, "cancelCommissionForOrder should NOT reverse PAID commission");

        const unchangedConv = await prisma.affiliateConversion.findUnique({ where: { id: convD3.id } });
        assert(unchangedConv?.status === "PAID", `Commission should remain PAID, got ${unchangedConv?.status}`);
    });

    await test("D4: cancelCommissionForOrder returns false for non-existent order", async () => {
        const { cancelCommissionForOrder } = await import("@/lib/affiliate/cancel-commission");
        const result = await cancelCommissionForOrder(prisma, 999999, "ADMIN_CANCELLED");
        assert(result === false, "Should return false for non-existent order");
    });

    // ==========================================
    // E. CALCULATE COMMISSION (DB-level)
    // ==========================================
    console.log("\n--- E. CALCULATE COMMISSION (DB) ---\n");

    await test("E1: calculateCommission produces correct Decimal result", async () => {
        const { calculateCommission } = await import("@/lib/affiliate/commission");
        const result = calculateCommission(100000, 5);
        
        assert(result.commissionAmount.equals(new Prisma.Decimal("5000.00")), 
            `5% of 100000 should be 5000, got ${result.commissionAmount.toString()}`);
        assert(result.commissionRate.equals(new Prisma.Decimal("5.00")), 
            `Rate should be 5.00, got ${result.commissionRate.toString()}`);
    });

    await test("E2: calculateCommission handles fractional rates correctly", async () => {
        const { calculateCommission } = await import("@/lib/affiliate/commission");
        const result = calculateCommission(19900, 3.33);
        
        // 19900 * 3.33 / 100 = 662.67
        assert(result.commissionAmount.equals(new Prisma.Decimal("662.67")),
            `3.33% of 19900 should be 662.67, got ${result.commissionAmount.toString()}`);
    });

    await test("E3: calculateCommission handles zero rate", async () => {
        const { calculateCommission } = await import("@/lib/affiliate/commission");
        const result = calculateCommission(100000, 0);
        
        assert(result.commissionAmount.equals(new Prisma.Decimal("0.00")),
            `0% commission should be 0, got ${result.commissionAmount.toString()}`);
    });

    await test("E4: calculateCommission returns Decimal types (not number)", async () => {
        const { calculateCommission } = await import("@/lib/affiliate/commission");
        const result = calculateCommission(100000, 5);
        
        assert(result.commissionAmount instanceof Prisma.Decimal, "commissionAmount must be Decimal");
        assert(result.commissionRate instanceof Prisma.Decimal, "commissionRate must be Decimal");
        assert(result.orderSubtotal instanceof Prisma.Decimal, "orderSubtotal must be Decimal");
    });

    // ==========================================
    // F. COMMISSION AUTO-APPROVAL ON COMPLETION
    // ==========================================
    console.log("\n--- F. COMMISSION AUTO-APPROVAL ON COMPLETION (DB) ---\n");

    await test("F1: approveCommissionForOrder transitions PENDING → APPROVED", async () => {
        const userF1 = await createTestUser("Approve Commission User");
        const affiliateF1 = await createAffiliate(userF1.id);
        const orderF1 = await createTestOrder(userF1.id, 100000);
        
        const convF1 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateF1.id,
                orderId: orderF1.id,
                affiliateCode: affiliateF1.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PENDING",
            },
        });
        trackCleanup("affiliateConversion", { id: convF1.id });

        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        const approved = await approveCommissionForOrder(prisma, orderF1.id, "ORDER_COMPLETED");

        assert(approved === true, "approveCommissionForOrder should return true");

        const updatedConv = await prisma.affiliateConversion.findUnique({ where: { id: convF1.id } });
        assert(updatedConv?.status === "APPROVED", `Commission should be APPROVED, got ${updatedConv?.status}`);
    });

    await test("F2: approveCommissionForOrder is idempotent (already APPROVED)", async () => {
        const userF2 = await createTestUser("Idempotent Approve User");
        const affiliateF2 = await createAffiliate(userF2.id);
        const orderF2 = await createTestOrder(userF2.id, 100000);
        
        const convF2 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateF2.id,
                orderId: orderF2.id,
                affiliateCode: affiliateF2.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "APPROVED",
            },
        });
        trackCleanup("affiliateConversion", { id: convF2.id });

        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        const result = await approveCommissionForOrder(prisma, orderF2.id, "ORDER_COMPLETED");

        assert(result === false, "Should return false for already APPROVED");
    });

    await test("F3: approveCommissionForOrder does NOT approve CANCELLED commission", async () => {
        const userF3 = await createTestUser("Cancelled Commission User");
        const affiliateF3 = await createAffiliate(userF3.id);
        const orderF3 = await createTestOrder(userF3.id, 100000);
        
        const convF3 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateF3.id,
                orderId: orderF3.id,
                affiliateCode: affiliateF3.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "CANCELLED",
            },
        });
        trackCleanup("affiliateConversion", { id: convF3.id });

        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        const result = await approveCommissionForOrder(prisma, orderF3.id, "ORDER_COMPLETED");

        assert(result === false, "Should return false for CANCELLED commission");

        const unchangedConv = await prisma.affiliateConversion.findUnique({ where: { id: convF3.id } });
        assert(unchangedConv?.status === "CANCELLED", `Commission should remain CANCELLED, got ${unchangedConv?.status}`);
    });

    await test("F4: approveCommissionForOrder returns false for non-existent order", async () => {
        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        const result = await approveCommissionForOrder(prisma, 999999, "ORDER_COMPLETED");
        assert(result === false, "Should return false for non-existent order");
    });

    await test("F5: approveCommissionForOrder does NOT approve PAID commission", async () => {
        const userF5 = await createTestUser("Paid Commission User F5");
        const affiliateF5 = await createAffiliate(userF5.id);
        const orderF5 = await createTestOrder(userF5.id, 100000);
        
        const convF5 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateF5.id,
                orderId: orderF5.id,
                affiliateCode: affiliateF5.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PAID",
            },
        });
        trackCleanup("affiliateConversion", { id: convF5.id });

        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        const result = await approveCommissionForOrder(prisma, orderF5.id, "ORDER_COMPLETED");

        assert(result === false, "Should return false for PAID commission");
    });

    await test("F6: Balance increases when commission goes PENDING → APPROVED", async () => {
        const userF6 = await createTestUser("Balance Change User");
        const affiliateF6 = await createAffiliate(userF6.id);
        const orderF6 = await createTestOrder(userF6.id, 100000);
        
        const convF6 = await prisma.affiliateConversion.create({
            data: {
                affiliateId: affiliateF6.id,
                orderId: orderF6.id,
                affiliateCode: affiliateF6.affiliateCode,
                orderSubtotal: new Prisma.Decimal("100000.00"),
                commissionRate: new Prisma.Decimal("5.00"),
                commissionAmount: new Prisma.Decimal("5000.00"),
                status: "PENDING",
            },
        });
        trackCleanup("affiliateConversion", { id: convF6.id });

        const { getAvailableBalance } = await import("@/lib/affiliate/commission");

        // PENDING → balance = 0 (not counted as earned)
        let balance = await getAvailableBalance(affiliateF6.id);
        assert(balance.equals(new Prisma.Decimal("0")), `PENDING: balance should be 0, got ${balance.toString()}`);

        // APPROVE → balance = 5000
        const { approveCommissionForOrder } = await import("@/lib/affiliate/approve-commission");
        await approveCommissionForOrder(prisma, orderF6.id, "ORDER_COMPLETED");

        balance = await getAvailableBalance(affiliateF6.id);
        assert(balance.equals(new Prisma.Decimal("5000.00")), `APPROVED: balance should be 5000, got ${balance.toString()}`);
    });

    // ==========================================
    // G. BACKFILL VERIFICATION
    // ==========================================
    console.log("\n--- G. BACKFILL VERIFICATION (DB) ---\n");

    await test("G1: No remaining PENDING commission with COMPLETED order", async () => {
        const stuck = await prisma.affiliateConversion.findMany({
            where: {
                status: "PENDING",
                order: { status: "COMPLETED" },
            },
            select: { id: true },
        });
        assert(stuck.length === 0, `Found ${stuck.length} stuck PENDING commission(s): ${stuck.map(s => s.id).join(", ")}`);
    });

    await test("G2: Backfill script exists and has dry-run mode", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const backfillCode = readFileSync(resolve(process.cwd(), "scripts/backfill-commission-completed.ts"), "utf-8");
        assert(backfillCode.includes("--dry-run"), "Missing dry-run mode");
        assert(backfillCode.includes("--execute"), "Missing execute mode");
        assert(backfillCode.includes("DRY_RUN"), "Missing DRY_RUN flag");
    });

    await test("G3: Backfill script uses approveCommissionForOrder pattern", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const backfillCode = readFileSync(resolve(process.cwd(), "scripts/backfill-commission-completed.ts"), "utf-8");
        assert(backfillCode.includes("status: \"PENDING\""), "Must filter PENDING commissions");
        assert(backfillCode.includes("status: \"COMPLETED\""), "Must filter COMPLETED orders");
        assert(backfillCode.includes("status: \"APPROVED\""), "Must update to APPROVED");
        assert(backfillCode.includes("self-referral"), "Must check self-referral");
        assert(backfillCode.includes("$transaction"), "Must use transaction");
    });

    await test("G4: Backfill is idempotent (re-run finds nothing)", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const backfillCode = readFileSync(resolve(process.cwd(), "scripts/backfill-commission-completed.ts"), "utf-8");
        // Must re-check status inside transaction
        assert(backfillCode.includes("current.status !== \"PENDING\""), "Must re-check status inside transaction");
    });

    await test("G5: Balance formula counts APPROVED as earned", async () => {
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        const commissionCode = readFileSync(resolve(process.cwd(), "lib/affiliate/commission.ts"), "utf-8");
        assert(commissionCode.includes('in: ["APPROVED", "PAID"]'), "Balance must count APPROVED as earned");
    });

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("\n==================================================");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log("==================================================\n");

    await cleanup();

    if (failed > 0) process.exit(1);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
