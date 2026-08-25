import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as XLSX from "xlsx";

/* ==========================================
 * POST /api/admin/orders/tracking-error-report
 * ==========================================
 *
 * Accepts JSON body with failed rows from
 * a previous import and generates an Excel
 * error report.
 *
 * Body:
 * {
 *   errors: Array<{
 *     row: number;
 *     orderNumber: string;
 *     trackingNumber: string;
 *     courier: string;
 *     status: string;
 *     reason: string;
 *   }>
 * }
 *
 * Returns: Excel file download
 */

type ErrorRow = {
    row: number;
    orderNumber: string;
    trackingNumber: string;
    courier: string;
    status: string;
    reason: string;
};

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                { status: 403 }
            );
        }

        /* ==========================================
         * PARSE BODY
         * ========================================== */

        let body: { errors?: ErrorRow[] };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Gagal membaca request body.",
                },
                { status: 400 }
            );
        }

        const errors = body.errors;

        if (!Array.isArray(errors)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "errors harus berupa array.",
                },
                { status: 400 }
            );
        }

        if (errors.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Tidak ada error untuk di-download.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * MAX ERRORS LIMIT
         * ========================================== */

        if (errors.length > 500) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Terlalu banyak error rows.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * CREATE ERROR REPORT EXCEL
         * ========================================== */

        const errorRows = errors.map(
            (e: ErrorRow) => ({
                "Baris Excel": e.row,
                "Nomor Pesanan":
                    e.orderNumber || "-",
                "Nomor Resi":
                    e.trackingNumber || "-",
                Ekspedisi: e.courier || "-",
                Status: e.status,
                Alasan: e.reason,
            })
        );

        const sheet =
            XLSX.utils.json_to_sheet(errorRows);

        sheet["!cols"] = [
            { wch: 12 }, // Baris Excel
            { wch: 30 }, // Nomor Pesanan
            { wch: 30 }, // Nomor Resi
            { wch: 20 }, // Ekspedisi
            { wch: 12 }, // Status
            { wch: 50 }, // Alasan
        ];

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            sheet,
            "Error Report"
        );

        /* ==========================================
         * GENERATE EXCEL BUFFER
         * ========================================== */

        const buffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx",
        });

        const filename = `error-report-import-resi-${new Date()
            .toISOString()
            .slice(0, 10)}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition":
                    `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error(
            "ERROR REPORT DOWNLOAD ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membuat error report.",
            },
            { status: 500 }
        );
    }
}
