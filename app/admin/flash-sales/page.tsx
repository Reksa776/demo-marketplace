"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiZap } from "react-icons/fi";

type FlashSale = {
    id: number;
    name: string;
    productId: number;
    variantId: number;
    salePrice: string | number;
    saleStock: number;
    soldCount: number;
    purchaseLimit: number | null;
    startAt: string;
    endAt: string;
    isActive: boolean;
    createdAt: string;
    product?: { id: number; name: string } | null;
    variant?: { id: number; name: string } | null;
};

type Product = {
    id: number;
    name: string;
    variants: { id: number; name: string; price: string | number; stock: number }[];
};

type FormState = {
    name: string;
    productId: string;
    variantId: string;
    salePrice: string;
    saleStock: string;
    purchaseLimit: string;
    startAt: string;
    endAt: string;
    isActive: boolean;
};

const emptyForm: FormState = {
    name: "",
    productId: "",
    variantId: "",
    salePrice: "",
    saleStock: "",
    purchaseLimit: "1",
    startAt: "",
    endAt: "",
    isActive: true,
};

function formatRupiah(value: string | number) {
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function toDateTimeLocal(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function readJsonResponse(response: Response) {
    const text = await response.text();
    if (!text) throw new Error(`Server tidak mengembalikan response. Status: ${response.status}`);
    try { return JSON.parse(text); } catch { throw new Error(`Server mengembalikan response bukan JSON. Status: ${response.status}`); }
}

export default function AdminFlashSalesPage() {
    const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FlashSale | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const selectedProduct = products.find((p) => String(p.id) === form.productId);

    async function loadFlashSales() {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/flash-sales", { cache: "no-store" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil data flash sale.");
            setFlashSales(result.data?.items ?? (Array.isArray(result.data) ? result.data : []));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
        }
    }

    async function loadProducts() {
        try {
            const response = await fetch("/api/admin/products", { cache: "no-store" });
            const result = await readJsonResponse(response);
            if (response.ok && result.success) {
                setProducts(result.data?.items ?? (Array.isArray(result.data) ? result.data : []));
            }
        } catch { /* ignore */ }
    }

    useEffect(() => { loadFlashSales(); loadProducts(); }, []);

    function openCreateModal() {
        setEditingItem(null);
        setForm({ ...emptyForm });
        setError(""); setSuccess(""); setModalOpen(true);
    }

    function openEditModal(item: FlashSale) {
        setEditingItem(item);
        setForm({
            name: item.name,
            productId: String(item.productId),
            variantId: String(item.variantId),
            salePrice: String(Number(item.salePrice)),
            saleStock: String(item.saleStock),
            purchaseLimit: item.purchaseLimit != null ? String(item.purchaseLimit) : "1",
            startAt: toDateTimeLocal(item.startAt),
            endAt: toDateTimeLocal(item.endAt),
            isActive: item.isActive,
        });
        setError(""); setSuccess(""); setModalOpen(true);
    }

    function closeModal() {
        if (saving) return;
        setModalOpen(false); setEditingItem(null); setForm({ ...emptyForm }); setError(""); setSuccess("");
    }

    function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((c) => ({ ...c, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(""); setSuccess("");

        if (!form.name.trim()) { setError("Nama wajib diisi."); return; }
        if (!form.productId) { setError("Produk wajib dipilih."); return; }
        if (!form.variantId) { setError("Variant wajib dipilih."); return; }

        const salePrice = Number(form.salePrice);
        if (!Number.isFinite(salePrice) || salePrice <= 0) { setError("Harga flash sale harus lebih dari 0."); return; }

        const saleStock = Number(form.saleStock);
        if (!Number.isInteger(saleStock) || saleStock <= 0) { setError("Stok flash sale harus lebih dari 0."); return; }

        if (!form.startAt || !form.endAt) { setError("Tanggal mulai dan selesai wajib diisi."); return; }
        if (new Date(form.endAt) <= new Date(form.startAt)) { setError("Tanggal selesai harus setelah tanggal mulai."); return; }

        try {
            setSaving(true);
            const payload = {
                name: form.name.trim(),
                productId: Number(form.productId),
                variantId: Number(form.variantId),
                salePrice,
                saleStock,
                purchaseLimit: form.purchaseLimit ? Number(form.purchaseLimit) : 1,
                startAt: new Date(form.startAt).toISOString(),
                endAt: new Date(form.endAt).toISOString(),
                isActive: form.isActive,
            };

            const url = editingItem ? `/api/admin/flash-sales/${editingItem.id}` : "/api/admin/flash-sales";
            const method = editingItem ? "PATCH" : "POST";

            const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan flash sale.");

            setSuccess(editingItem ? "Flash sale berhasil diubah." : "Flash sale berhasil dibuat.");
            await loadFlashSales();
            window.setTimeout(closeModal, 700);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(item: FlashSale) {
        const confirmed = window.confirm(`Hapus flash sale "${item.name}"?\n\nTindakan ini tidak bisa dibatalkan.`);
        if (!confirmed) return;

        try {
            setDeletingId(item.id); setError(""); setSuccess("");
            const response = await fetch(`/api/admin/flash-sales/${item.id}`, { method: "DELETE" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menghapus flash sale.");
            setSuccess("Flash sale berhasil dihapus.");
            await loadFlashSales();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menghapus flash sale.");
        } finally {
            setDeletingId(null);
        }
    }

    async function toggleActive(item: FlashSale) {
        try {
            setError(""); setSuccess("");
            const response = await fetch(`/api/admin/flash-sales/${item.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !item.isActive }),
            });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengubah status.");
            await loadFlashSales();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengubah status.");
        }
    }

    const filtered = flashSales.filter((fs) => {
        if (!search.trim()) return true;
        const kw = search.toLowerCase();
        return fs.name.toLowerCase().includes(kw) || (fs.product?.name ?? "").toLowerCase().includes(kw);
    });

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>Admin</span><span>/</span><span className="text-gray-600">Flash Sale</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Flash Sale</h1>
                        <p className="mt-1 text-sm text-gray-500">Kelola flash sale produk dengan harga khusus dan stok terbatas.</p>
                    </div>
                    <button type="button" onClick={openCreateModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800">
                        <FiZap size={16} /> Tambah Flash Sale
                    </button>
                </div>

                {error && <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="mt-0.5 font-bold">!</span><span>{error}</span></div>}
                {success && <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><span className="mt-0.5 font-bold">✓</span><span>{success}</span></div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-950">Daftar Flash Sale</h2>
                            <p className="mt-0.5 text-xs text-gray-400">{filtered.length} flash sale</p>
                        </div>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari flash sale..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white md:w-72" />
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                            <FiZap size={24} className="text-gray-400" />
                            <p className="mt-4 text-sm font-semibold text-gray-900">Belum ada flash sale</p>
                            <button type="button" onClick={openCreateModal} className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-500">Tambah flash sale</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead><tr className="border-b border-gray-200 bg-gray-50/80">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nama</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Produk / Variant</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Harga</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Stok</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Periode</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((fs) => {
                                        const remaining = Math.max(0, fs.saleStock - fs.soldCount);
                                        return (
                                            <tr key={fs.id} className="group transition hover:bg-gray-50/70">
                                                <td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{fs.name}</p></td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-gray-700">{fs.product?.name ?? `#${fs.productId}`}</p>
                                                    <p className="text-xs text-gray-400">{fs.variant?.name ?? `#${fs.variantId}`}</p>
                                                </td>
                                                <td className="px-5 py-4"><p className="text-sm font-semibold text-rose-600">{formatRupiah(fs.salePrice)}</p></td>
                                                <td className="px-5 py-4">
                                                    <p className={`text-sm font-semibold ${remaining === 0 ? "text-red-600" : remaining <= 5 ? "text-amber-600" : "text-gray-900"}`}>{remaining}</p>
                                                    <p className="text-[11px] text-gray-400">tersisa / {fs.soldCount} terjual</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-xs text-gray-700">{formatDate(fs.startAt)}</p>
                                                    <p className="text-xs text-gray-400">s/d {formatDate(fs.endAt)}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <button type="button" onClick={() => toggleActive(fs)} className="inline-flex items-center gap-2 text-xs font-medium">
                                                        <span className={`h-2 w-2 rounded-full ${fs.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                                                        <span className={fs.isActive ? "text-emerald-700" : "text-gray-400"}>{fs.isActive ? "Aktif" : "Nonaktif"}</span>
                                                    </button>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button type="button" onClick={() => openEditModal(fs)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100">Edit</button>
                                                        <button type="button" disabled={deletingId === fs.id} onClick={() => handleDelete(fs)} className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deletingId === fs.id ? "..." : "Hapus"}</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[92vh] w-full max-w-xl overflow-hidden bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Flash Sale</p>
                                <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{editingItem ? "Edit flash sale" : "Buat flash sale baru"}</h2>
                            </div>
                            <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-76px)] overflow-y-auto">
                            <div className="space-y-5 px-6 py-6">
                                {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Nama flash sale</label>
                                    <input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="Contoh: Flash Sale Ramadhan" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Produk</label>
                                        <select value={form.productId} onChange={(e) => { updateForm("productId", e.target.value); updateForm("variantId", ""); }} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400">
                                            <option value="">Pilih produk</option>
                                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Variant</label>
                                        <select value={form.variantId} onChange={(e) => updateForm("variantId", e.target.value)} disabled={!selectedProduct} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400 disabled:opacity-50">
                                            <option value="">Pilih variant</option>
                                            {selectedProduct?.variants.map((v) => <option key={v.id} value={v.id}>{v.name} — {formatRupiah(v.price)} (stok: {v.stock})</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Harga flash sale (Rp)</label>
                                        <input type="number" value={form.salePrice} onChange={(e) => updateForm("salePrice", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="1" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Stok flash sale</label>
                                        <input type="number" value={form.saleStock} onChange={(e) => updateForm("saleStock", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="1" disabled={!!editingItem} />
                                        {editingItem && <p className="mt-1 text-[11px] text-gray-400">Stok tidak bisa diubah setelah dibuat</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Batas pembelian per user</label>
                                    <input type="number" value={form.purchaseLimit} onChange={(e) => updateForm("purchaseLimit", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="1" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal mulai</label>
                                        <input type="datetime-local" value={form.startAt} onChange={(e) => updateForm("startAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal selesai</label>
                                        <input type="datetime-local" value={form.endAt} onChange={(e) => updateForm("endAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => updateForm("isActive", !form.isActive)} className={`relative h-6 w-11 rounded-full transition ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}>
                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.isActive ? "left-[22px]" : "left-0.5"}`} />
                                    </button>
                                    <span className="text-sm text-gray-700">{form.isActive ? "Aktif" : "Nonaktif"}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Batal</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">{saving ? "Menyimpan..." : editingItem ? "Simpan Perubahan" : "Buat Flash Sale"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
