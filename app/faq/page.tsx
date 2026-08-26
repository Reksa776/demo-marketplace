import type { Metadata } from "next";
import FaqContent from "./FaqContent";

export const metadata: Metadata = {
    title: "FAQ | Pertanyaan Umum",
    description:
        "Temukan jawaban atas pertanyaan umum seputar cara berbelanja, pembayaran, pengiriman, pengembalian, dan layanan pelanggan di toko kami.",
    openGraph: {
        title: "FAQ | Pertanyaan Umum",
        description:
            "Temukan jawaban atas pertanyaan umum seputar cara berbelanja, pembayaran, pengiriman, pengembalian, dan layanan pelanggan.",
    },
};

export default function FaqPage() {
    return (
        <main className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
                {/* HEADER */}
                <div className="mb-8 text-center">
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-4 py-1.5 text-sm font-semibold text-rose-600">
                        ❓ FAQ
                    </span>

                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Pertanyaan Umum
                    </h1>

                    <p className="mt-3 text-base text-gray-500">
                        Temukan jawaban atas pertanyaan yang
                        sering ditanyakan oleh customer kami.
                    </p>
                </div>

                {/* FAQ LIST */}
                <FaqContent />
            </div>
        </main>
    );
}
