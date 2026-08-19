import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type ValidateVoucherResult =
    | {
          valid: true;
          voucher: {
              id: number;
              code: string;
              type: "PERCENTAGE" | "FIXED";
          };
          discount: number;
      }
    | {
          valid: false;
          message: string;
      };

/*
 * ==========================================
 * VALIDATE & CALCULATE DISCOUNT
 * ==========================================
 *
 * Dipakai di DUA tempat:
 *
 * 1. POST /api/voucher/validate
 *    -> preview diskon di halaman checkout, pakai `prisma` biasa.
 *
 * 2. Di DALAM transaction pembuatan order
 *    (buy-now maupun checkout keranjang)
 *    -> WAJIB pakai `tx` (transaction client), bukan `prisma`
 *    biasa, dan WAJIB dipanggil ulang di sana meskipun sudah
 *    divalidasi di langkah 1. Jangan pernah percaya nilai
 *    discount yang dikirim dari client.
 */
export async function validateAndCalculateVoucher(
    code: string,
    subtotal: number,
    client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ValidateVoucherResult> {
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
        return {
            valid: false,
            message: "Kode voucher tidak boleh kosong.",
        };
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
        return {
            valid: false,
            message: "Subtotal tidak valid.",
        };
    }

    const voucher = await client.voucher.findUnique({
        where: { code: trimmedCode },
    });

    if (!voucher) {
        return {
            valid: false,
            message: "Kode voucher tidak ditemukan.",
        };
    }

    if (!voucher.isActive) {
        return {
            valid: false,
            message: "Voucher ini sudah tidak aktif.",
        };
    }

    const now = new Date();

    if (voucher.startDate && now < voucher.startDate) {
        return {
            valid: false,
            message: "Voucher ini belum bisa digunakan.",
        };
    }

    if (voucher.endDate && now > voucher.endDate) {
        return {
            valid: false,
            message: "Voucher ini sudah kedaluwarsa.",
        };
    }

    if (voucher.quota !== null && voucher.usedCount >= voucher.quota) {
        return {
            valid: false,
            message: "Kuota voucher ini sudah habis.",
        };
    }

    const minPurchase = voucher.minPurchase
        ? Number(voucher.minPurchase)
        : 0;

    if (subtotal < minPurchase) {
        return {
            valid: false,
            message: `Minimal belanja Rp ${minPurchase.toLocaleString(
                "id-ID"
            )} untuk pakai voucher ini.`,
        };
    }

    let discount = 0;

    if (voucher.type === "PERCENTAGE") {
        discount = (subtotal * Number(voucher.value)) / 100;

        const maxDiscount = voucher.maxDiscount
            ? Number(voucher.maxDiscount)
            : null;

        if (maxDiscount !== null && discount > maxDiscount) {
            discount = maxDiscount;
        }
    } else {
        discount = Number(voucher.value);
    }

    /*
     * Diskon nggak boleh lebih besar dari subtotal
     * (mencegah total order jadi negatif).
     */
    if (discount > subtotal) {
        discount = subtotal;
    }

    discount = Math.round(discount);

    return {
        valid: true,
        voucher: {
            id: voucher.id,
            code: voucher.code,
            type: voucher.type,
        },
        discount,
    };
}

/*
 * ==========================================
 * MARK VOUCHER USED (ATOMIC)
 * ==========================================
 *
 * WAJIB dipanggil di dalam transaction yang SAMA
 * dengan pembuatan order, SETELAH order berhasil
 * dibuat, supaya:
 *
 * - Kalau order gagal dibuat (misal stock habis
 *   di tengah jalan), usedCount voucher nggak
 *   ikut naik.
 *
 * - Kalau dua request masuk bersamaan pas kuota
 *   tinggal 1, cuma salah satu yang berhasil
 *   (pakai UPDATE ber-syarat via raw SQL, bukan
 *   read-then-write biasa yang rawan race
 *   condition).
 *
 * Return `true` kalau berhasil dipakai, `false`
 * kalau ternyata kuota baru saja habis (harus
 * di-throw sebagai error dan rollback transaction-nya).
 */
export async function incrementVoucherUsage(
    tx: Prisma.TransactionClient,
    voucherId: number
): Promise<boolean> {
    const updated = await tx.$executeRaw`
        UPDATE Voucher
        SET usedCount = usedCount + 1
        WHERE id = ${voucherId}
          AND isActive = true
          AND (quota IS NULL OR usedCount < quota)
    `;

    return updated === 1;
}