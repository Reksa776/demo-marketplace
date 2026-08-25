/**
 * BACKFILL: PENDING commission + COMPLETED order → APPROVED
 *
 * Finds all AffiliateConversion records where:
 *   - commission.status = PENDING
 *   - order.status = COMPLETED
 *   - order is NOT self-referral (affiliate.userId !== order.userId)
 *
 * Updates them to APPROVED using the existing approveCommissionForOrder()
 * pattern (same logic, but batch for efficiency).
 *
 * Usage:
 *   npx tsx scripts/backfill-commission-completed.ts --dry-run   (preview only)
 *   npx tsx scripts/backfill-commission-completed.ts --execute   (apply changes)
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes("--execute");

async function main() {
    console.log("\n==================================================");
    console.log(`  BACKFILL: PENDING commission + COMPLETED order`);
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "EXECUTE (applying changes)"}`);
    console.log("==================================================\n");

    // Find all PENDING commissions with COMPLETED orders
    const pendingCommissions = await prisma.affiliateConversion.findMany({
        where: {
            status: "PENDING",
            order: {
                status: "COMPLETED",
            },
        },
        select: {
            id: true,
            affiliateId: true,
            orderId: true,
            commissionAmount: true,
            commissionRate: true,
            orderSubtotal: true,
            affiliate: {
                select: {
                    userId: true,
                },
            },
            order: {
                select: {
                    userId: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                },
            },
        },
    });

    console.log(`Found ${pendingCommissions.length} PENDING commission(s) with COMPLETED order(s).\n`);

    if (pendingCommissions.length === 0) {
        console.log("Nothing to do. Exiting.");
        return;
    }

    // Filter out self-referrals and invalid records
    const validCommissions = pendingCommissions.filter((c) => {
        // Self-referral check
        if (c.affiliate.userId === c.order.userId) {
            console.log(`  SKIP #${c.id}: Self-referral (affiliate.userId === order.userId)`);
            return false;
        }
        return true;
    });

    const skippedSelfReferral = pendingCommissions.length - validCommissions.length;

    console.log(`\nValid commissions to approve: ${validCommissions.length}`);
    if (skippedSelfReferral > 0) {
        console.log(`Skipped (self-referral): ${skippedSelfReferral}`);
    }

    // Display details
    console.log("\n--- Records to update ---\n");
    for (const c of validCommissions) {
        console.log(
            `  Conversion #${c.id}: ` +
            `Order ${c.order.orderNumber} (COMPLETED/${c.order.paymentStatus}) → ` +
            `Commission Rp${Number(c.commissionAmount).toLocaleString("id-ID")} ` +
            `(${Number(c.commissionRate)}% of Rp${Number(c.orderSubtotal).toLocaleString("id-ID")})`
        );
    }

    // Preview balance impact
    const totalAmount = validCommissions.reduce(
        (sum, c) => sum.add(c.commissionAmount),
        new Prisma.Decimal(0)
    );
    console.log(`\nTotal commission to approve: Rp${Number(totalAmount).toLocaleString("id-ID")}`);

    if (DRY_RUN) {
        console.log("\n--- DRY RUN COMPLETE ---");
        console.log("No changes were made. Run with --execute to apply.\n");
        return;
    }

    // Execute backfill
    console.log("\n--- EXECUTING BACKFILL ---\n");

    let approved = 0;
    let failed = 0;

    for (const c of validCommissions) {
        try {
            await prisma.$transaction(async (tx) => {
                // Re-check status inside transaction (idempotent)
                const current = await tx.affiliateConversion.findUnique({
                    where: { id: c.id },
                    select: { status: true },
                });

                if (!current || current.status !== "PENDING") {
                    console.log(`  SKIP #${c.id}: Status changed to ${current?.status} (concurrent edit)`);
                    return;
                }

                // PENDING → APPROVED
                await tx.affiliateConversion.update({
                    where: { id: c.id },
                    data: { status: "APPROVED" },
                });

                console.log(`  ✅ #${c.id}: PENDING → APPROVED (order ${c.order.orderNumber})`);
                approved++;
            });
        } catch (error: any) {
            console.error(`  ❌ #${c.id}: FAILED - ${error.message}`);
            failed++;
        }
    }

    console.log(`\n--- BACKFILL COMPLETE ---`);
    console.log(`Approved: ${approved}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${validCommissions.length}`);

    // Verify balance impact
    if (approved > 0) {
        console.log("\n--- BALANCE VERIFICATION ---\n");
        const affiliateIds = [...new Set(validCommissions.map((c) => c.affiliateId))];

        for (const affId of affiliateIds) {
            const earned = await prisma.affiliateConversion.aggregate({
                where: {
                    affiliateId: affId,
                    status: { in: ["APPROVED", "PAID"] },
                },
                _sum: { commissionAmount: true },
            });

            const disbursed = await prisma.affiliatePayout.aggregate({
                where: {
                    affiliateId: affId,
                    status: { in: ["PENDING", "PROCESSING", "PAID"] },
                },
                _sum: { amount: true },
            });

            const earnedAmount = earned._sum.commissionAmount ?? new Prisma.Decimal(0);
            const disbursedAmount = disbursed._sum.amount ?? new Prisma.Decimal(0);
            const available = earnedAmount.sub(disbursedAmount);
            const balance = available.gt(0) ? available : new Prisma.Decimal(0);

            console.log(
                `  Affiliate #${affId}: ` +
                `Earned Rp${Number(earnedAmount).toLocaleString("id-ID")} - ` +
                `Disbursed Rp${Number(disbursedAmount).toLocaleString("id-ID")} = ` +
                `Available Rp${Number(balance).toLocaleString("id-ID")}`
            );
        }
    }

    console.log("");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
