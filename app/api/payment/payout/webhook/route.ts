/**
 * POST /api/payment/payout/webhook
 *
 * Webhook endpoint for disbursement provider confirmation.
 * Handles async status updates from Midtrans Iris or similar providers.
 *
 * Flow:
 *   1. Verify webhook signature
 *   2. Find payout by provider reference
 *   3. Lock payout row
 *   4. Validate state transition
 *   5. Update payout status
 *   6. If SUCCESS: settle commissions, set paidAt
 *   7. If FAILED: set failedAt, failureReason
 *   8. Audit log
 *
 * Idempotent:
 *   - Duplicate webhook → no-op
 *   - Already PAID → no change
 *   - Already FAILED → no change (unless retry succeeds)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleCommissionsForPayout } from "@/lib/affiliate/commission";
import { verifyWebhookSignature } from "@/lib/affiliate/payout-provider";
import { createAuditLog } from "@/lib/admin/audit-log";

export const dynamic = "force-dynamic";

type WebhookPayload = {
    reference_id?: string;
    id?: string;
    status?: string;
    amount?: number;
    beneficiary_name?: string;
    beneficiary_account?: string;
    beneficiary_bank?: string;
    notes?: string;
    failure_code?: string;
    failure_reason?: string;
};

export async function POST(request: Request) {
    try {
        const body = await request.text();
        const signature =
            request.headers.get("x-signature") ||
            request.headers.get("x-webhook-signature") ||
            "";

        /* ==========================================
         * SIGNATURE VERIFICATION
         * ========================================== */

        if (!verifyWebhookSignature(body, signature)) {
            console.error(
                "[PAYOUT WEBHOOK] Invalid signature"
            );
            return NextResponse.json(
                { success: false, message: "Invalid signature" },
                { status: 401 }
            );
        }

        const payload: WebhookPayload = JSON.parse(body);

        console.log(
            `[PAYOUT WEBHOOK] Received: ${JSON.stringify(payload)}`
        );

        /* ==========================================
         * FIND PAYOUT
         * ========================================== */

        const payout = await prisma.affiliatePayout.findFirst({
            where: {
                OR: [
                    {
                        providerReference:
                            payload.reference_id || undefined,
                    },
                    {
                        providerTransactionId:
                            payload.id || undefined,
                    },
                ],
            },
            select: {
                id: true,
                status: true,
                affiliateId: true,
                amount: true,
                providerTransactionId: true,
                providerReference: true,
            },
        });

        if (!payout) {
            console.error(
                `[PAYOUT WEBHOOK] Payout not found for reference: ${payload.reference_id || payload.id}`
            );
            return NextResponse.json(
                { success: false, message: "Payout not found" },
                { status: 404 }
            );
        }

        /* ==========================================
         * IDEMPOTENT: Already in final state
         * ========================================== */

        if (payout.status === "PAID") {
            console.log(
                `[PAYOUT WEBHOOK] Payout #${payout.id} already PAID — no-op`
            );
            return NextResponse.json({
                success: true,
                message: "Already processed",
            });
        }

        if (
            payout.status === "FAILED" ||
            payout.status === "REJECTED" ||
            payout.status === "CANCELLED"
        ) {
            console.log(
                `[PAYOUT WEBHOOK] Payout #${payout.id} already ${payout.status} — no-op`
            );
            return NextResponse.json({
                success: true,
                message: `Already ${payout.status}`,
            });
        }

        /* ==========================================
         * PROCESS STATUS UPDATE
         * ========================================== */

        const newStatus = payload.status?.toLowerCase();
        const isSuccess =
            newStatus === "success" ||
            newStatus === "completed" ||
            newStatus === "paid";
        const isFailed =
            newStatus === "failed" ||
            newStatus === "rejected" ||
            newStatus === "cancelled" ||
            newStatus === "expired";

        await prisma.$transaction(async (tx) => {
            if (isSuccess) {
                /* ==========================================
                 * SUCCESS: PROCESSING → PAID
                 * ========================================== */

                const affectedRows = await tx.$executeRaw`
                    UPDATE AffiliatePayout
                    SET status = 'PAID',
                        paidAt = IFNULL(paidAt, CURRENT_TIMESTAMP),
                        providerTransactionId = COALESCE(${payload.id}, providerTransactionId),
                        providerStatus = ${newStatus || "success"}
                    WHERE id = ${payout.id}
                      AND status IN ('PENDING', 'PROCESSING')
                `;

                if (affectedRows === 0) {
                    console.log(
                        `[PAYOUT WEBHOOK] Payout #${payout.id}: already transitioned (concurrent webhook)`
                    );
                    return;
                }

                /* ==========================================
                 * COMMISSION SETTLEMENT
                 * ==========================================
                 *
                 * Move APPROVED commissions to PAID using
                 * FIFO allocation. This is idempotent.
                 */
                const settledCount =
                    await settleCommissionsForPayout(payout.id);

                console.log(
                    `[PAYOUT WEBHOOK] Payout #${payout.id} → PAID. Settled ${settledCount} commission(s).`
                );

                await createAuditLog({
                    adminId: "SYSTEM",
                    action: "PAYOUT_PAID",
                    entityType: "AffiliatePayout",
                    entityId: payout.id,
                    description: `Payout confirmed by provider via webhook`,
                    metadata: {
                        providerTransactionId:
                            payload.id,
                        providerReference:
                            payload.reference_id,
                        settledCount,
                    },
                });
            } else if (isFailed) {
                /* ==========================================
                 * FAILED: PROCESSING → FAILED
                 * ========================================== */

                const affectedRows = await tx.$executeRaw`
                    UPDATE AffiliatePayout
                    SET status = 'FAILED',
                        failedAt = IFNULL(failedAt, CURRENT_TIMESTAMP),
                        failureReason = ${payload.failure_reason || payload.failure_code || newStatus || "Unknown"},
                        providerStatus = ${newStatus || "failed"}
                    WHERE id = ${payout.id}
                      AND status IN ('PENDING', 'PROCESSING')
                `;

                if (affectedRows === 0) {
                    console.log(
                        `[PAYOUT WEBHOOK] Payout #${payout.id}: already transitioned`
                    );
                    return;
                }

                console.log(
                    `[PAYOUT WEBHOOK] Payout #${payout.id} → FAILED: ${payload.failure_reason || newStatus}`
                );

                await createAuditLog({
                    adminId: "SYSTEM",
                    action: "PAYOUT_FAILED",
                    entityType: "AffiliatePayout",
                    entityId: payout.id,
                    description: `Payout failed: ${payload.failure_reason || newStatus}`,
                    metadata: {
                        providerTransactionId:
                            payload.id,
                        failureReason:
                            payload.failure_reason,
                    },
                });
            } else {
                console.log(
                    `[PAYOUT WEBHOOK] Unknown status: ${newStatus} for payout #${payout.id}`
                );

                // Update providerStatus for tracking
                await tx.affiliatePayout.update({
                    where: { id: payout.id },
                    data: {
                        providerStatus: newStatus || null,
                    },
                });
            }
        });

        return NextResponse.json({
            success: true,
            message: "Webhook processed",
        });
    } catch (error: any) {
        console.error("[PAYOUT WEBHOOK] Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Webhook processing failed",
            },
            { status: 500 }
        );
    }
}
