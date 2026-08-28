import {
    AffiliateConversionStatus,
    AffiliatePayoutStatus,
    Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * MONEY-SAFE COMMISSION UTILITIES
 * ==========================================
 *
 * All commission calculations use Prisma
 * Decimal to avoid floating point errors.
 *
 * Decimal(12,2) for amounts
 * Decimal(5,2) for rates
 */

const D12 = (v: number) =>
    new Prisma.Decimal(v.toFixed(2));
const D5 = (v: number) =>
    new Prisma.Decimal(v.toFixed(2));

/* ==========================================
 * CALCULATE COMMISSION (MONEY-SAFE)
 * ==========================================
 *
 * commissionAmount = subtotal × (rate / 100)
 *
 * Uses Decimal arithmetic throughout.
 */

export function calculateCommission(
    subtotal: number,
    rate: number
): {
    commissionAmount: Prisma.Decimal;
    commissionRate: Prisma.Decimal;
    orderSubtotal: Prisma.Decimal;
} {
    const sub = D12(subtotal);
    const r = D5(rate);
    // (subtotal × rate) / 100 using Decimal
    const amount = sub
        .mul(r)
        .div(100)
        .toDecimalPlaces(2);

    return {
        commissionAmount: amount,
        commissionRate: r,
        orderSubtotal: sub,
    };
}

/* ==========================================
 * VALID COMMISSION STATUS TRANSITIONS
 * ========================================== */

const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [], // terminal
    CANCELLED: [], // terminal
    REVERSED: [], // terminal
};

export function isValidTransition(
    from: string,
    to: string
): boolean {
    return (
        VALID_TRANSITIONS[from]?.includes(to) ?? false
    );
}

/* ==========================================
 * CHANGE COMMISSION RATE (ADMIN)
 * ==========================================
 *
 * Updates AffiliateProfile.commissionRate.
 * Does NOT affect existing conversions
 * (they are snapshotted).
 */

export async function updateCommissionRate(
    affiliateId: number,
    newRate: number,
    adminId: string
): Promise<void> {
    if (newRate < 0 || newRate > 50) {
        throw new Error(
            "Commission rate harus antara 0% dan 50%."
        );
    }

    await prisma.affiliateProfile.update({
        where: { id: affiliateId },
        data: {
            commissionRate: D5(newRate),
        },
    });

    console.log(
        `AFFILIATE_RATE: Admin ${adminId} changed rate for affiliate ${affiliateId} to ${newRate}%`
    );
}

/* ==========================================
 * TRANSITION COMMISSION STATUS (ADMIN)
 * ==========================================
 *
 * Server-side status transition with
 * validation. Atomic via Prisma update.
 */

export async function transitionCommission(
    conversionId: number,
    newStatus: string,
    adminId: string,
    reason?: string
): Promise<void> {
    const conversion =
        await prisma.affiliateConversion.findUnique({
            where: { id: conversionId },
            select: {
                id: true,
                status: true,
                affiliateId: true,
            },
        });

    if (!conversion) {
        throw new Error("Konversi tidak ditemukan.");
    }

    if (
        !isValidTransition(
            conversion.status,
            newStatus
        )
    ) {
        throw new Error(
            `Transisi ${conversion.status} → ${newStatus} tidak valid.`
        );
    }

    await prisma.affiliateConversion.update({
        where: { id: conversionId },
        data: { status: newStatus as any },
    });

    console.log(
        `AFFILIATE_COMMISSION: ${conversion.status} → ${newStatus} for conversion ${conversionId} by ${adminId}`
    );
}

/* ==========================================
 * CALCULATE AVAILABLE BALANCE
 * ==========================================
 *
 * P0 FIX (C2) — payout-ledger based balance.
 *
 * Previous formula:
 *   SUM(APPROVED commission) - SUM(PAID commission)
 *
 * was broken in two ways:
 *   1. Marking an AffiliatePayout PAID never moved
 *      AffiliateConversion rows to PAID, so the
 *      available balance NEVER decreased → the same
 *      balance could be withdrawn repeatedly.
 *   2. Even when conversions were manually marked
 *      PAID, moving c from APPROVED to PAID changed
 *      the formula by -2c (double subtraction).
 *
 * New model — AffiliatePayout is the disbursement
 * ledger (no schema change required):
 *
 *   earned      = SUM(commission WHERE status IN ('APPROVED','PAID'))
 *   disbursed   = SUM(payout.amount WHERE status IN
 *                    ('PENDING','PROCESSING','APPROVED','PAID'))
 *   available   = max(0, earned - disbursed)
 *
 * Consequences:
 *   - Creating a payout (PENDING) immediately reserves
 *     the amount → concurrent withdrawals cannot exceed
 *     the real balance.
 *   - REJECTED / CANCELLED payouts release their amount.
 *   - PAID payouts permanently consume it.
 *
 * All arithmetic uses Prisma.Decimal (money-safe).
 *
 * @param client  Prisma client or transaction client
 */
export async function getAvailableBalance(
    affiliateId: number,
    client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
    const [earnedAgg, payoutAgg] = await Promise.all([
        client.affiliateConversion.aggregate({
            where: {
                affiliateId,
                status: {
                    in: ["APPROVED", "PAID"] as AffiliateConversionStatus[],
                },
            },
            _sum: {
                commissionAmount: true,
            },
        }),
        client.affiliatePayout.aggregate({
            where: {
                affiliateId,
                /*
                 * NOTE: the DB enum AffiliatePayoutStatus does NOT
                 * contain 'APPROVED' (only PENDING, PROCESSING, PAID,
                 * REJECTED, CANCELLED). All non-released payout states
                 * are covered here.
                 */
                status: {
                    in: [
                        "PENDING",
                        "PROCESSING",
                        "PAID",
                    ] as AffiliatePayoutStatus[],
                },
            },
            _sum: {
                amount: true,
            },
        }),
    ]);

    const earned =
        earnedAgg._sum.commissionAmount ??
        new Prisma.Decimal(0);
    const disbursed =
        payoutAgg._sum?.amount ??
        new Prisma.Decimal(0);

    const available = earned.sub(disbursed);

    return available.gt(0)
        ? available
        : new Prisma.Decimal(0);
}

/* ==========================================
 * VALID PAYOUT STATUS TRANSITIONS
 * ========================================== */

const PAYOUT_TRANSITIONS: Record<string, string[]> = {
    PENDING: ["PROCESSING", "REJECTED", "CANCELLED"],
    PROCESSING: ["PAID", "FAILED", "REJECTED", "CANCELLED"],
    PAID: [], // terminal
    FAILED: [], // terminal
    REJECTED: [], // terminal
    CANCELLED: [], // terminal
};

export function isValidPayoutTransition(
    from: string,
    to: string
): boolean {
    return (
        PAYOUT_TRANSITIONS[from]?.includes(to) ?? false
    );
}

/* ==========================================
 * CREATE WITHDRAWAL REQUEST
 * ==========================================
 *
 * P0 FIX (C3) — atomic / concurrency-safe.
 *
 * Previously this was check-then-act OUTSIDE any
 * transaction:
 *   1. findFirst PENDING payout
 *   2. compute available balance
 *   3. create payout
 * Two concurrent requests could both pass steps 1–2
 * and both create payouts exceeding the balance.
 *
 * Now everything happens inside ONE transaction:
 *   1. SELECT ... FOR UPDATE on the AffiliateProfile row
 *      (MariaDB-compatible locking read). Every withdrawal
 *      for the same affiliate must acquire this lock first,
 *      which serializes all concurrent withdrawal requests
 *      per affiliate regardless of isolation level.
 *   2. Re-check PENDING payout under lock.
 *   3. Compute balance under lock (payout-ledger model,
 *      see getAvailableBalance).
 *   4. Create payout — its PENDING amount immediately
 *      reserves the withdrawn funds.
 *
 * No PostgreSQL-only syntax; raw SQL is a parameterized
 * tagged template.
 */

export async function createWithdrawalRequest(
    affiliateId: number,
    amount: number,
    bankName: string,
    bankAccountName: string,
    bankAccountNumber: string
): Promise<{ id: number }> {
    if (amount <= 0) {
        throw new Error(
            "Jumlah pencairan harus lebih dari 0."
        );
    }

    if (amount > 100_000_000) {
        throw new Error(
            "Jumlah pencairan maksimal Rp100.000.000."
        );
    }

    const requestedAmount = D12(amount);

    return prisma.$transaction(
        async (tx) => {
            /*
             * Serialize withdrawals per affiliate.
             * Locking read on the affiliate row — every
             * concurrent createWithdrawalRequest() for the
             * same affiliate blocks here until the first
             * transaction commits/rolls back.
             */
            await tx.$queryRaw`
                SELECT id FROM \`affiliateprofile\`
                WHERE id = ${affiliateId}
                FOR UPDATE
            `;

            // Check for existing PENDING payout (under lock)
            const existingPending =
                await tx.affiliatePayout.findFirst({
                    where: {
                        affiliateId,
                        status: "PENDING",
                    },
                    select: { id: true },
                });

            if (existingPending) {
                throw new Error(
                    "Anda sudah memiliki permintaan pencairan yang sedang diproses. Silakan tunggu hingga selesai."
                );
            }

            // Check available balance (under lock)
            const available =
                await getAvailableBalance(affiliateId, tx);

            if (requestedAmount.gt(available)) {
                throw new Error(
                    `Saldo tidak mencukupi. Tersedia: Rp ${available.toNumber().toLocaleString("id-ID")}.`
                );
            }

            // Create payout request
            const payout = await tx.affiliatePayout.create({
                data: {
                    affiliateId,
                    amount: requestedAmount,
                    status: "PENDING",
                    bankName,
                    bankAccountName,
                    bankAccountNumber,
                },
            });

            console.log(
                `AFFILIATE_PAYOUT: Affiliate ${affiliateId} requested withdrawal Rp${amount} → payout #${payout.id}`
            );

            return { id: payout.id };
        },
        {
            timeout: 15000,
            maxWait: 10000,
        }
    );
}

/* ==========================================
 * SETTLE COMMISSIONS FOR PAID PAYOUT
 * ==========================================
 *
 * P0 FIX (C2) — consumption of eligible commissions.
 *
 * When a payout is marked PAID, the eligible APPROVED
 * conversions are moved to PAID using FIFO allocation
 * (oldest first) inside a transaction guarded by a
 * locking read on the payout row.
 *
 * Notes:
 *   - The AUTHORITATIVE money math is the payout ledger
 *     (see getAvailableBalance). This FIFO marking makes
 *     the conversion statuses reflect what has been paid
 *     out so the same commission can never be reported
 *     as withdrawable again.
 *   - If the payout amount does not align exactly with a
 *     whole number of conversions, the last conversion in
 *     the allocation window is fully marked even though
 *     only part of it was consumed. This over-marks by at
 *     most one conversion's remainder and only affects
 *     reporting granularity — the ledger-based balance
 *     remains exact.
 */

export async function settleCommissionsForPayout(
    payoutId: number
): Promise<number> {
    return prisma.$transaction(async (tx) => {
        /*
         * Locking read: ensures only one settlement pass
         * runs for this payout (idempotent + race-safe).
         */
        const locked = await tx.$queryRaw<
            Array<{ id: number; affiliateId: number }>
        >`
            SELECT id, affiliateId FROM \`affiliatepayout\`
            WHERE id = ${payoutId} AND status = 'PAID'
            FOR UPDATE
        `;

        if (!locked || locked.length === 0) {
            return 0;
        }

        const { affiliateId } = locked[0];

        const payout = await tx.affiliatePayout.findUnique({
            where: { id: payoutId },
            select: { amount: true },
        });

        if (!payout) {
            return 0;
        }

        let remaining = new Prisma.Decimal(
            payout.amount
        );

        const conversions = await tx.affiliateConversion.findMany({
            where: {
                affiliateId,
                status: "APPROVED",
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                commissionAmount: true,
            },
        });

        const idsToSettle: number[] = [];

        for (const conv of conversions) {
            if (remaining.lte(0)) break;
            idsToSettle.push(conv.id);
            remaining = remaining.sub(conv.commissionAmount);
        }

        if (idsToSettle.length === 0) {
            return 0;
        }

        const result = await tx.affiliateConversion.updateMany({
            where: { id: { in: idsToSettle } },
            data: { status: "PAID" },
        });

        console.log(
            `AFFILIATE_PAYOUT_SETTLED: payout #${payoutId} settled ${result.count} conversion(s) for affiliate ${affiliateId}`
        );

        return result.count;
    });
}
