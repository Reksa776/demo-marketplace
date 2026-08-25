import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

/* ==========================================
 * GET /api/admin/orders/tracking-template
 * ==========================================
 *
 * Downloads an Excel template pre-filled with
 * actual orders from the database that are
 * eligible for tracking number assignment.
 *
 * Filter rules (based on existing order lifecycle):
 *   - trackingNumber IS NULL or empty
 *   - status != CANCELLED
 *   - status != COMPLETED (already fulfilled)
 *
 * Template columns:
 *   - orderNumber  (read-only from DB)
 *   - trackingNumber (admin fills in)
 *   - courier      (admin fills in)
 *
 * Read-only informational columns:
 *   - customerName
 *   - orderDate
 *   - shippingCourier (reference)
 *   - status
 *
 * Includes a "Petunjuk" sheet with instructions.
 */

const MAX_TEMPLATE_ROWS = 500;

export async function GET() {
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
         * QUERY: Orders eligible for tracking
         * ==========================================
         *
         * Rules:
         *   1. trackingNumber IS NULL or empty
         *   2. status NOT IN (CANCELLED, COMPLETED)
         *
         * We use findMany with OR for null/empty
         * trackingNumber, and NOT IN for blocked
         * statuses.
         */

        const orders = await prisma.order.findMany({
            where: {
                AND: [
                    // trackingNumber IS NULL or empty
                    {
                        OR: [
                            { trackingNumber: null },
                            { trackingNumber: "" },
                        ],
                    },
                    // Exclude completed/cancelled
                    {
                        status: {
                            notIn: [
                                "CANCELLED",
                                "COMPLETED",
                            ],
                        },
                    },
                ],
            },

            orderBy: {
                createdAt: "desc",
            },

            select: {
                id: true,
                orderNumber: true,
                recipientName: true,
                createdAt: true,
                shippingCourier: true,
                shippingService: true,
                status: true,
                total: true,
            },

            take: MAX_TEMPLATE_ROWS,
        });

        /* ==========================================
         * EDGE CASE: No eligible orders
         * ========================================== */

        if (orders.length === 0) {
            const workbook =
                XLSX.utils.book_new();

            // Empty template sheet with headers
            const emptySheet =
                XLSX.utils.json_to_sheet([]);

            // Set column headers manually
            XLSX.utils.sheet_add_aoa(
                emptySheet,
                [
                    [
                        "orderNumber",
                        "trackingNumber",
                        "courier",
                        "customerName",
                        "orderDate",
                        "shippingCourier",
                        "status",
                    ],
                ],
                { origin: "A1" }
            );

            emptySheet["!cols"] = [
                { wch: 30 }, // orderNumber
                { wch: 30 }, // trackingNumber
                { wch: 20 }, // courier
                { wch: 25 }, // customerName
                { wch: 20 }, // orderDate
                { wch: 20 }, // shippingCourier
                { wch: 15 }, // status
            ];

            XLSX.utils.book_append_sheet(
                workbook,
                emptySheet,
                "Template"
            );

            // Petunjuk sheet with empty result notice
            const instructions = [
                {
                    "Template Import Resi":
                        "",
                },
                { "": "" },
                {
                    "Status":
                        "Tidak ada order yang perlu diisi resi saat ini.",
                },
                {
                    "Keterangan":
                        "Semua order sudah memiliki nomor resi atau tidak ada order aktif.",
                },
                { "": "" },
                {
                    "Kolom": "Keterangan",
                },
                {
                    Kolom: "orderNumber",
                    Keterangan:
                        "Nomor pesanan (read-only, dari sistem)",
                },
                {
                    Kolom: "trackingNumber",
                    Keterangan:
                        "Nomor resi / AWB (wajib diisi oleh admin)",
                },
                {
                    Kolom: "courier",
                    Keterangan:
                        "Ekspedisi: JNE, J&T, SiCepat, AnterAja, POS, dll (wajib diisi)",
                },
                {
                    Kolom: "customerName",
                    Keterangan:
                        "Nama penerima (informasi saja, jangan diedit)",
                },
                {
                    Kolom: "orderDate",
                    Keterangan:
                        "Tanggal order (informasi saja)",
                },
                {
                    Kolom: "shippingCourier",
                    Keterangan:
                        "Kurir yang dipilih customer (referensi)",
                },
                {
                    Kolom: "status",
                    Keterangan:
                        "Status order saat ini (informasi saja)",
                },
                { "": "" },
                { "CATATAN PENTING": "" },
                {
                    Kolom: "1",
                    Keterangan:
                        "Jangan mengubah kolom orderNumber",
                },
                {
                    Kolom: "2",
                    Keterangan:
                        "Isi trackingNumber dengan nomor resi",
                },
                {
                    Kolom: "3",
                    Keterangan:
                        "Isi courier dengan nama ekspedisi",
                },
                {
                    Kolom: "4",
                    Keterangan:
                        "Jangan menghapus baris order",
                },
                {
                    Kolom: "5",
                    Keterangan:
                        "Upload kembali file melalui tombol Import Resi Excel",
                },
                {
                    Kolom: "6",
                    Keterangan:
                        "Format file: .xlsx",
                },
            ];

            const instructionSheet =
                XLSX.utils.json_to_sheet(instructions);

            instructionSheet["!cols"] = [
                { wch: 25 },
                { wch: 70 },
            ];

            XLSX.utils.book_append_sheet(
                workbook,
                instructionSheet,
                "Petunjuk"
            );

            const buffer = XLSX.write(workbook, {
                type: "buffer",
                bookType: "xlsx",
            });

            const filename =
                "template-import-resi.xlsx";

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
        }

        /* ==========================================
         * SHEET 1: TEMPLATE DATA (from database)
         * ==========================================
         *
         * Columns:
         *   orderNumber     — from DB (admin keeps)
         *   trackingNumber  — empty (admin fills)
         *   courier         — empty (admin fills)
         *   customerName    — read-only info
         *   orderDate       — read-only info
         *   shippingCourier — read-only info (reference)
         *   status          — read-only info
         */

        const templateRows = orders.map(
            (order) => ({
                orderNumber: order.orderNumber,
                trackingNumber: "",
                courier:
                    order.shippingCourier ?? "",
                customerName:
                    order.recipientName ?? "",
                orderDate: new Date(
                    order.createdAt
                ).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }),
                shippingCourier:
                    order.shippingCourier ?? "-",
                status: order.status,
            })
        );

        const templateSheet =
            XLSX.utils.json_to_sheet(templateRows);

        templateSheet["!cols"] = [
            { wch: 30 }, // orderNumber
            { wch: 30 }, // trackingNumber
            { wch: 20 }, // courier
            { wch: 25 }, // customerName
            { wch: 20 }, // orderDate
            { wch: 20 }, // shippingCourier
            { wch: 15 }, // status
        ];

        /* ==========================================
         * SHEET 2: PETUNJUK (INSTRUCTIONS)
         * ========================================== */

        const instructions = [
            {
                "Petunjuk Pengisian Template Resi":
                    "",
            },
            { "": "" },
            {
                "Info":
                    `${orders.length} order perlu diisi resi`,
            },
            { "": "" },
            { "Kolom": "Keterangan" },
            {
                Kolom: "orderNumber",
                Keterangan:
                    "Nomor pesanan dari sistem (JANGAN diubah)",
            },
            {
                Kolom: "trackingNumber",
                Keterangan:
                    "Nomor resi / nomor AWB pengiriman (WAJIB diisi)",
            },
            {
                Kolom: "courier",
                Keterangan:
                    "Ekspedisi: JNE, J&T, SiCepat, AnterAja, POS, dll (WAJIB diisi). Sudah terisi dengan kurir pilihan customer.",
            },
            {
                Kolom: "customerName",
                Keterangan:
                    "Nama penerima (informasi saja, jangan diedit)",
            },
            {
                Kolom: "orderDate",
                Keterangan:
                    "Tanggal order (informasi saja)",
            },
            {
                Kolom: "shippingCourier",
                Keterangan:
                    "Kurir yang dipilih customer saat checkout (referensi)",
            },
            {
                Kolom: "status",
                Keterangan:
                    "Status order saat ini (informasi saja)",
            },
            { "": "" },
            { "CATATAN PENTING": "" },
            {
                Kolom: "1",
                Keterangan:
                    "Jangan mengubah nama kolom (header) pada sheet Template",
            },
            {
                Kolom: "2",
                Keterangan:
                    "Jangan menghapus baris header (baris pertama)",
            },
            {
                Kolom: "3",
                Keterangan:
                    "Jangan mengubah isi kolom orderNumber",
            },
            {
                Kolom: "4",
                Keterangan:
                    "Isi trackingNumber dengan nomor resi aktual",
            },
            {
                Kolom: "5",
                Keterangan:
                    "Isi courier dengan nama ekspedisi (atau biarkan jika sudah sesuai)",
            },
            {
                Kolom: "6",
                Keterangan:
                    "Jangan menghapus baris order dari template",
            },
            {
                Kolom: "7",
                Keterangan:
                    "Jika order sudah memiliki nomor resi yang sama, tidak akan ada perubahan (idempotent)",
            },
            {
                Kolom: "8",
                Keterangan:
                    "Jika order sudah memiliki nomor resi berbeda, baris tersebut akan gagal",
            },
            {
                Kolom: "9",
                Keterangan:
                    "Jangan menggunakan rumus Excel, masukkan data sebagai teks",
            },
            {
                Kolom: "10",
                Keterangan:
                    "Upload kembali file melalui tombol \"Import Resi Excel\"",
            },
            {
                Kolom: "11",
                Keterangan:
                    "Format file: .xlsx",
            },
        ];

        const instructionSheet =
            XLSX.utils.json_to_sheet(instructions);

        instructionSheet["!cols"] = [
            { wch: 25 },
            { wch: 70 },
        ];

        /* ==========================================
         * CREATE WORKBOOK
         * ========================================== */

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            templateSheet,
            "Template"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            instructionSheet,
            "Petunjuk"
        );

        /* ==========================================
         * GENERATE EXCEL BUFFER
         * ========================================== */

        const buffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx",
        });

        const filename =
            "template-import-resi.xlsx";

        console.log(
            `TRACKING_TEMPLATE: Admin ${session.user.id} — ${orders.length} eligible orders`
        );

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
            "TRACKING TEMPLATE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membuat template resi.",
            },
            { status: 500 }
        );
    }
}
