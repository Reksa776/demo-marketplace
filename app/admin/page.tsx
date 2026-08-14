import Link from "next/link";
import {
    FiArrowRight,
    FiBox,
    FiShoppingBag,
    FiSettings,
    FiTrendingUp,
    FiUsers,
} from "react-icons/fi";

export default function AdminPage() {
    return (
        <div className="min-h-screen">
            {/* HEADER */}
            <div className="border-b border-gray-200 bg-white">
                <div className="mx-auto max-w-7xl px-5 py-7 sm:px-6">
                    <div>
                        <p className="text-sm font-medium text-rose-600">
                            Admin Dashboard
                        </p>

                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                            Dashboard
                        </h1>

                        <p className="mt-2 text-sm text-gray-500">
                            Kelola toko, produk, pesanan,
                            dan pengaturan aplikasi.
                        </p>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6">
                {/* STAT CARDS */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Total Produk"
                        value="—"
                        description="Produk di katalog"
                        icon={FiBox}
                    />

                    <StatCard
                        title="Pesanan"
                        value="—"
                        description="Total pesanan"
                        icon={FiShoppingBag}
                    />

                    <StatCard
                        title="Pengguna"
                        value="—"
                        description="Pengguna terdaftar"
                        icon={FiUsers}
                    />

                    <StatCard
                        title="Penjualan"
                        value="—"
                        description="Total penjualan"
                        icon={FiTrendingUp}
                    />
                </div>

                {/* QUICK ACTION */}
                <section className="mt-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-900">
                            Menu Cepat
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Akses fitur administrasi toko.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AdminMenuCard
                            href="/admin/products"
                            icon={FiBox}
                            title="Kelola Produk"
                            description="Tambah, edit, hapus produk dan atur variant."
                        />

                        <AdminMenuCard
                            href="/admin/orders"
                            icon={FiShoppingBag}
                            title="Kelola Pesanan"
                            description="Lihat dan proses pesanan pelanggan."
                        />

                        <AdminMenuCard
                            href="/admin/users"
                            icon={FiUsers}
                            title="Kelola Pengguna"
                            description="Lihat pengguna dan akun yang terdaftar."
                        />

                        <AdminMenuCard
                            href="/admin/settings"
                            icon={FiSettings}
                            title="Pengaturan Toko"
                            description="Atur identitas toko, alamat dan konfigurasi."
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    description,
    icon: Icon,
}: {
    title: string;
    value: string;
    description: string;
    icon: any;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">
                        {title}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-gray-900">
                        {value}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                        {description}
                    </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
}

function AdminMenuCard({
    href,
    icon: Icon,
    title,
    description,
}: {
    href: string;
    icon: any;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition group-hover:bg-rose-50 group-hover:text-rose-600">
                    <Icon size={20} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-900">
                            {title}
                        </h3>

                        <FiArrowRight
                            size={18}
                            className="shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-rose-600"
                        />
                    </div>

                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        {description}
                    </p>
                </div>
            </div>
        </Link>
    );
}