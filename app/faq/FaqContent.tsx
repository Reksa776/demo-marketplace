"use client";

import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";

type FaqItem = {
    question: string;
    answer: string;
};

const faqData: FaqItem[] = [
    {
        question: "Bagaimana cara melakukan pembelian?",
        answer:
            "Pilih produk yang diinginkan, pilih varian dan jumlah, lalu tambahkan ke keranjang. Setelah itu, buka keranjang, pilih alamat pengiriman, metode pembayaran, dan lakukan pembayaran. Pesanan akan diproses setelah pembayaran berhasil dikonfirmasi.",
    },
    {
        question: "Metode pembayaran apa saja yang tersedia?",
        answer:
            "Kami menyediakan beberapa metode pembayaran, antara lain: COD (Bayar di Tempat), Transfer Bank, E-Wallet, dan QRIS. Pilih metode yang paling nyaman untuk Anda saat checkout.",
    },
    {
        question: "Bagaimana cara mengetahui status pesanan saya?",
        answer:
            "Anda dapat melihat status pesanan melalui halaman Orders di akun Anda. Status pesanan akan diperbarui secara berkerti, mulai dari Menunggu Pembayaran, Diproses, Dikirim, hingga Selesai. Anda juga akan menerima notifikasi melalui WhatsApp terkait perubahan status pesanan.",
    },
    {
        question: "Bagaimana cara melacak pengiriman?",
        answer:
            "Setelah pesanan dikirim, nomor resi dan kurir pengiriman akan tersedia di halaman detail pesanan Anda. Anda dapat melacak pengiriman langsung melalui link yang tersedia atau menggunakan layanan pelacakan dari kurir terkait.",
    },
    {
        question: "Berapa lama estimasi pengiriman?",
        answer:
            "Estimasi pengiriman tergantung pada kurir dan layanan pengiriman yang Anda pilih, serta lokasi pengiriman. Estimasi akan ditampilkan saat Anda memilih layanan pengiriman di halaman checkout. Untuk wilayah Jawa, biasanya memakan waktu 1-3 hari kerja. Untuk luar Jawa, estimasi dapat bervariasi.",
    },
    {
        question: "Bagaimana cara menggunakan voucher atau promo?",
        answer:
            "Masukkan kode voucher di kolom yang tersedia saat checkout. Pastikan voucher memenuhi syarat dan ketentuan yang berlaku, seperti minimal pembelian atau kategori produk tertentu. Diskon akan otomatis terpotong dari total belanja Anda.",
    },
    {
        question: "Bisakah saya membatalkan pesanan?",
        answer:
            "Pesanan dapat dibatalkan selama status masih Menunggu Pembayaran atau belum diproses. Untuk membatalkan pesanan, silakan hubungi customer service kami melalui halaman Kontak. Pesanan yang sudah dikirim tidak dapat dibatalkan.",
    },
    {
        question: "Bagaimana cara mengajukan pengembalian dana (refund)?",
        answer:
            "Untuk informasi lengkap mengenai pengembalian dana, silakan kunjungi halaman Kebijakan Refund kami. Secara umum, Anda dapat mengajukan refund jika produk yang diterima dalam kondisi rusak atau tidak sesuai pesanan. Silakan hubungi customer service kami untuk memulai proses pengembalian dana.",
    },
    {
        question: "Bagaimana cara menghubungi customer service?",
        answer:
            "Anda dapat menghubungi customer service kami melalui halaman Kontak. Kami menyediakan email dan nomor telepon yang dapat Anda hubungi. Silakan sertakan nomor pesanan Anda agar kami dapat membantu dengan lebih cepat.",
    },
];

function FaqAccordionItem({
    item,
    isOpen,
    onToggle,
}: {
    item: FaqItem;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            >
                <span className="text-sm font-semibold text-gray-900 sm:text-base">
                    {item.question}
                </span>

                <FiChevronDown
                    size={18}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {isOpen && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4 sm:px-6">
                    <p className="text-sm leading-7 text-gray-600">
                        {item.answer}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function FaqContent() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="space-y-3">
            {faqData.map((item, index) => (
                <FaqAccordionItem
                    key={index}
                    item={item}
                    isOpen={openIndex === index}
                    onToggle={() =>
                        setOpenIndex(
                            openIndex === index ? null : index
                        )
                    }
                />
            ))}
        </div>
    );
}
