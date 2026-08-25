import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createWithdrawalRequest, getAvailableBalance } from "@/lib/affiliate/commission";

/* ==========================================
 * GET /api/affiliate/payouts
 * ==========================================
 *
 * Customer list of own payout requests.
 */

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }

        const affiliate = await prisma.affiliateProfile.findFirst({
            where: { userId: session.user.id, status: "APPROVED" },
            select: { id: true },
        });

        if (!affiliate) {
            return NextResponse.json({ success: false, message: "Akun Anda belum menjadi affiliator." }, { status: 403 });
        }

        const payouts = await prisma.affiliatePayout.findMany({
            where: { affiliateId: affiliate.id },
            orderBy: { requestedAt: "desc" },
            take: 50,
            select: {
                id: true,
                amount: true,
                status: true,
                bankName: true,
                bankAccountName: true,
                bankAccountNumber: true,
                requestedAt: true,
                processedAt: true,
                paidAt: true,
                providerReference: true,
                proofFilePath: true,
                rejectionReason: true,
                failureReason: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: payouts.map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                status: p.status,
                bankName: p.bankName,
                bankAccountName: p.bankAccountName,
                bankAccountNumber: p.bankAccountNumber.replace(/.(?=.{4})/g, "*"),
                requestedAt: p.requestedAt.toISOString(),
                processedAt: p.processedAt?.toISOString() ?? null,
                paidAt: p.paidAt?.toISOString() ?? null,
                providerReference: p.providerReference ?? null,
                proofFilePath: p.proofFilePath ?? null,
                rejectionReason: p.rejectionReason ?? null,
                failureReason: p.failureReason ?? null,
            })),
        });
    } catch (error) {
        console.error("AFFILIATE PAYOUTS LIST ERROR:", error);
        return NextResponse.json({ success: false, message: "Gagal mengambil data payout." }, { status: 500 });
    }
}

/* ==========================================
 * POST /api/affiliate/payouts
 * ==========================================
 *
 * Customer withdrawal request.
 *
 * Body:
 *   - amount: number
 *
 * Uses bank info from AffiliateKyc.
 * Server-side validation for amount.
 * Double-click protected by PENDING check.
 */

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }

        const affiliate = await prisma.affiliateProfile.findFirst({
            where: { userId: session.user.id, status: "APPROVED" },
            include: {
                kyc: {
                    select: { bankName: true, bankAccountName: true, bankAccountNumber: true },
                },
            },
        });

        if (!affiliate) {
            return NextResponse.json({ success: false, message: "Akun Anda belum menjadi affiliator." }, { status: 403 });
        }

        if (!affiliate.kyc) {
            return NextResponse.json({ success: false, message: "Data bank belum dilengkapi." }, { status: 400 });
        }

        const body = await req.json();
        const { amount } = body;

        if (typeof amount !== "number" || amount <= 0) {
            return NextResponse.json({ success: false, message: "Jumlah pencairan tidak valid." }, { status: 400 });
        }

        const result = await createWithdrawalRequest(
            affiliate.id,
            amount,
            affiliate.kyc.bankName,
            affiliate.kyc.bankAccountName,
            affiliate.kyc.bankAccountNumber
        );

        return NextResponse.json({
            success: true,
            message: "Permintaan pencairan berhasil diajukan.",
            data: { payoutId: result.id },
        });
    } catch (error) {
        console.error("AFFILIATE PAYOUT REQUEST ERROR:", error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : "Gagal mengajukan pencairan." },
            { status: 500 }
        );
    }
}
