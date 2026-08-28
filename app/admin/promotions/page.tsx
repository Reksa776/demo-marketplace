"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiImage } from "react-icons/fi";
import ProductImageUpload from "@/components/admin/ProductImageUpload";
import { useDialog } from "@/components/ui/Dialog";

type Promotion = {
    id: number;
    title: string;
    description: string | null;
    imageUrl: string | null;
    link: string | null;
    placement: string;
    priority: number;
    isActive: boolean;
    startAt: string | null;
    endAt: string | null;
    createdAt: string;
};

type FormState = {
    title: string;
    description: string;
    imageUrl: string;
    link: string;
    placement: string;
    priority: string;
    isActive: boolean;
    startAt: string;
    endAt: string;
};

const emptyForm: FormState = {
    title: "", description: "", imageUrl: "", link: "",
    placement: "HOMEPAGE", priority: "0", isActive: true, startAt: "", endAt: "",
};

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateTimeLocal(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function placementLabel(p: string) {
    switch (p) {
        case "HOMEPAGE": return "Halaman Utama";
        case "CAMPAIGN": return "Kampanye";
        case "CATEGORY": return "Kategori";
        case "PRODUCT": return "Produk";
        default: return p;
    }
}

async function readJsonResponse(response: Response) {
    const text = await response.text();
    if (!text) throw new Error(`Server error. Status: ${response.status}`);
    try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON. Status: ${response.status}`); }
}

export default function AdminPromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Promotion | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function loadPromotions() {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/promotions", { cache: "no-store" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil data.");
            setPromotions(result.data?.items ?? (Array.isArray(result.data) ? result.data : []));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadPromotions(); }, []);

    function openCreateModal() { setEditingItem(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); setModalOpen(true); }
    function openEditModal(item: Promotion) {
        setEditingItem(item);
        setForm({
            title: item.title, description: item.description || "", imageUrl: item.imageUrl || "",
            link: item.link || "", placement: item.placement, priority: String(item.priority),
            isActive: item.isActive, startAt: toDateTimeLocal(item.startAt), endAt: toDateTimeLocal(item.endAt),
        });
        setError(""); setSuccess(""); setModalOpen(true);
    }
    function closeModal() { if (saving) return; setModalOpen(false); setEditingItem(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); }
    function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((c) => ({ ...c, [key]: value })); }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault(); setError(""); setSuccess("");
        if (!form.title.trim()) { setError("Judul wajib diisi."); return; }

        try {
            setSaving(true);
            const payload: any = {
                title: form.title.trim(), description: form.description.trim() || null,
                imageUrl: form.imageUrl.trim() || null, link: form.link.trim() || null,
                placement: form.placement, priority: Number(form.priority) || 0,
                isActive: form.isActive,
            };
            if (form.startAt) payload.startAt = new Date(form.startAt).toISOString();
            if (form.endAt) payload.endAt = new Date(form.endAt).toISOString();

            const url = editingItem ? `/api/admin/promotions/${editingItem.id}` : "/api/admin/promotions";
            const method = editingItem ? "PATCH" : "POST";
            const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan.");

            setSuccess(editingItem ? "Promosi berhasil diubah." : "Promosi berhasil dibuat.");
            await loadPromotions(); window.setTimeout(closeModal, 700);
        } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan."); } finally { setSaving(false); }
    }

    const dialog = useDialog();

    async function handleDelete(item: Promotion) {
        if (!(await dialog.confirm({ title: "Hapus Promosi", message: `Hapus promosi "${item.title}"?`, variant: "danger", confirmText: "Hapus" }))) return;
        try {
            setDeletingId(item.id); setError(""); setSuccess("");
            const response = await fetch(`/api/admin/promotions/${item.id}`, { method: "DELETE" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menghapus.");
            setSuccess("Promosi berhasil dihapus."); await loadPromotions();
        } catch (err) { setError(err instanceof Error ? err.message : "Gagal menghapus."); } finally { setDeletingId(null); }
    }

    const filtered = promotions.filter((p) => !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><span>Admin</span><span>/</span><span className="text-gray-600">Promosi</span></div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Promosi</h1>
                        <p className="mt-1 text-sm text-gray-500">Kelola banner dan promosi di berbagai placement toko.</p>
                    </div>
                    <button type="button" onClick={openCreateModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800">
                        <FiImage size={16} /> Tambah Promosi
                    </button>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div><h2 className="text-sm font-semibold text-gray-950">Daftar Promosi</h2><p className="mt-0.5 text-xs text-gray-400">{filtered.length} promosi</p></div>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari promosi..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-gray-400 focus:bg-white md:w-72" />
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                            <FiImage size={24} className="text-gray-400" />
                            <p className="mt-4 text-sm font-semibold text-gray-900">Belum ada promosi</p>
                            <button type="button" onClick={openCreateModal} className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4">Tambah promosi</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left">
                                <thead><tr className="border-b border-gray-200 bg-gray-50/80">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Judul</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Placement</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prioritas</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Periode</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((p) => (
                                        <tr key={p.id} className="group transition hover:bg-gray-50/70">
                                            <td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{p.title}</p>{p.description && <p className="mt-0.5 max-w-[250px] truncate text-xs text-gray-400">{p.description}</p>}</td>
                                            <td className="px-5 py-4"><span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{placementLabel(p.placement)}</span></td>
                                            <td className="px-5 py-4"><span className="text-sm text-gray-700">{p.priority}</span></td>
                                            <td className="px-5 py-4"><p className="text-xs text-gray-700">{formatDate(p.startAt)}</p><p className="text-xs text-gray-400">s/d {formatDate(p.endAt)}</p></td>
                                            <td className="px-5 py-4"><span className={`text-xs font-medium ${p.isActive ? "text-emerald-600" : "text-gray-400"}`}>{p.isActive ? "Aktif" : "Nonaktif"}</span></td>
                                            <td className="px-5 py-4 text-right"><div className="flex justify-end gap-1">
                                                <button type="button" onClick={() => openEditModal(p)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100">Edit</button>
                                                <button type="button" disabled={deletingId === p.id} onClick={() => handleDelete(p)} className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deletingId === p.id ? "..." : "Hapus"}</button>
                                            </div></td>
                                        </tr>
                                    ))}
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
                            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Promosi</p><h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{editingItem ? "Edit promosi" : "Buat promosi baru"}</h2></div>
                            <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-76px)] overflow-y-auto">
                            <div className="space-y-5 px-6 py-6">
                                {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Judul</label><input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Deskripsi</label><textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} className="h-20 w-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Gambar Banner</label><ProductImageUpload value={form.imageUrl} onChange={(url) => updateForm("imageUrl", url)} /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Link</label><input type="url" value={form.link} onChange={(e) => updateForm("link", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="https://..." /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Placement</label>
                                        <select value={form.placement} onChange={(e) => updateForm("placement", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400">
                                            <option value="HOMEPAGE">Halaman Utama</option><option value="CAMPAIGN">Kampanye</option><option value="CATEGORY">Kategori</option><option value="PRODUCT">Produk</option>
                                        </select>
                                    </div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Prioritas</label><input type="number" value={form.priority} onChange={(e) => updateForm("priority", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="0" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal mulai</label><input type="datetime-local" value={form.startAt} onChange={(e) => updateForm("startAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal selesai</label><input type="datetime-local" value={form.endAt} onChange={(e) => updateForm("endAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => updateForm("isActive", !form.isActive)} className={`relative h-6 w-11 rounded-full transition ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.isActive ? "left-[22px]" : "left-0.5"}`} /></button>
                                    <span className="text-sm text-gray-700">{form.isActive ? "Aktif" : "Nonaktif"}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Batal</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">{saving ? "Menyimpan..." : editingItem ? "Simpan" : "Buat Promosi"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
