"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiTruck } from "react-icons/fi";
import { useDialog } from "@/components/ui/Dialog";

type ShippingDiscount = {
    id: number; name: string; code: string | null; type: string; value: string | number;
    maxDiscount: string | number | null; minPurchase: string | number | null;
    startAt: string; endAt: string; isActive: boolean;
};

type FormState = {
    name: string; code: string; type: string; value: string; maxDiscount: string;
    minPurchase: string; startAt: string; endAt: string; isActive: boolean;
};

const emptyForm: FormState = { name: "", code: "", type: "PERCENTAGE", value: "", maxDiscount: "", minPurchase: "", startAt: "", endAt: "", isActive: true };

function formatRupiah(v: string | number) { return `Rp ${Number(v).toLocaleString("id-ID")}`; }
function toDateTimeLocal(v: string | null) { if (!v) return ""; const d = new Date(v); if (isNaN(d.getTime())) return ""; const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); }
function formatDate(v: string) { return new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
async function readJson(r: Response) { const t = await r.text(); if (!t) throw new Error(`Server error ${r.status}`); try { return JSON.parse(t); } catch { throw new Error(`Invalid JSON ${r.status}`); } }

export default function AdminShippingDiscountsPage() {
    const [items, setItems] = useState<ShippingDiscount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ShippingDiscount | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function load() { try { setLoading(true); const r = await fetch("/api/admin/shipping-discounts", { cache: "no-store" }); const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message); setItems(res.data?.items ?? []); } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat."); } finally { setLoading(false); } }
    useEffect(() => { load(); }, []);

    function openCreate() { setEditing(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); setModalOpen(true); }
    function openEdit(item: ShippingDiscount) { setEditing(item); setForm({ name: item.name, code: item.code || "", type: item.type, value: String(Number(item.value)), maxDiscount: item.maxDiscount != null ? String(Number(item.maxDiscount)) : "", minPurchase: item.minPurchase != null ? String(Number(item.minPurchase)) : "", startAt: toDateTimeLocal(item.startAt), endAt: toDateTimeLocal(item.endAt), isActive: item.isActive }); setError(""); setSuccess(""); setModalOpen(true); }
    function closeModal() { if (saving) return; setModalOpen(false); setEditing(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); }
    function updateForm<K extends keyof FormState>(k: K, v: FormState[K]) { setForm((c) => ({ ...c, [k]: v })); }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault(); setError(""); setSuccess("");
        if (!form.name.trim()) { setError("Nama wajib diisi."); return; }
        const val = Number(form.value); if (!val || val <= 0) { setError("Nilai harus > 0."); return; }
        if (!form.startAt || !form.endAt) { setError("Tanggal wajib diisi."); return; }
        if (new Date(form.endAt) <= new Date(form.startAt)) { setError("Tanggal selesai harus setelah mulai."); return; }
        try {
            setSaving(true);
            const payload = { name: form.name.trim(), code: form.code.trim() || null, type: form.type, value: val, maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null, minPurchase: form.minPurchase ? Number(form.minPurchase) : null, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(), isActive: form.isActive };
            const url = editing ? `/api/admin/shipping-discounts/${editing.id}` : "/api/admin/shipping-discounts";
            const r = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message);
            setSuccess(editing ? "Berhasil diubah." : "Berhasil dibuat."); await load(); window.setTimeout(closeModal, 700);
        } catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); } finally { setSaving(false); }
    }

    const dialog = useDialog();

    async function handleDelete(item: ShippingDiscount) {
        if (!(await dialog.confirm({ title: "Hapus", message: `Hapus "${item.name}"?`, variant: "danger", confirmText: "Hapus" }))) return;
        try { setDeletingId(item.id); const r = await fetch(`/api/admin/shipping-discounts/${item.id}`, { method: "DELETE" }); const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message); setSuccess("Berhasil dihapus."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus."); } finally { setDeletingId(null); }
    }

    async function toggleActive(item: ShippingDiscount) {
        try { await fetch(`/api/admin/shipping-discounts/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) }); await load(); } catch { /* ignore */ }
    }

    const filtered = items.filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || (d.code ?? "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><span>Admin</span><span>/</span><span className="text-gray-600">Diskon Ongkir</span></div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Diskon Ongkir</h1>
                        <p className="mt-1 text-sm text-gray-500">Konfigurasi diskon biaya pengiriman.</p>
                    </div>
                    <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800"><FiTruck size={16} /> Tambah</button>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div><h2 className="text-sm font-semibold text-gray-950">Daftar Diskon Ongkir</h2><p className="mt-0.5 text-xs text-gray-400">{filtered.length} item</p></div>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-gray-400 focus:bg-white md:w-72" />
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><FiTruck size={24} className="text-gray-400" /><p className="mt-4 text-sm font-semibold text-gray-900">Belum ada diskon ongkir</p><button type="button" onClick={openCreate} className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4">Tambah sekarang</button></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left">
                                <thead><tr className="border-b border-gray-200 bg-gray-50/80">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nama</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Kode</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Diskon</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Min Belanja</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Periode</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((d) => (
                                        <tr key={d.id} className="group transition hover:bg-gray-50/70">
                                            <td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{d.name}</p></td>
                                            <td className="px-5 py-4">{d.code ? <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{d.code}</span> : <span className="text-xs text-gray-400">Auto</span>}</td>
                                            <td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{d.type === "PERCENTAGE" ? `${Number(d.value)}%` : formatRupiah(d.value)}</p>{d.maxDiscount && <p className="text-xs text-gray-400">Maks {formatRupiah(d.maxDiscount)}</p>}</td>
                                            <td className="px-5 py-4">{d.minPurchase ? <p className="text-sm text-gray-700">{formatRupiah(d.minPurchase)}</p> : <span className="text-xs text-gray-400">-</span>}</td>
                                            <td className="px-5 py-4"><p className="text-xs text-gray-700">{formatDate(d.startAt)}</p><p className="text-xs text-gray-400">s/d {formatDate(d.endAt)}</p></td>
                                            <td className="px-5 py-4"><button type="button" onClick={() => toggleActive(d)} className="inline-flex items-center gap-2 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${d.isActive ? "bg-emerald-500" : "bg-gray-300"}`} /><span className={d.isActive ? "text-emerald-700" : "text-gray-400"}>{d.isActive ? "Aktif" : "Nonaktif"}</span></button></td>
                                            <td className="px-5 py-4 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => openEdit(d)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100">Edit</button><button type="button" disabled={deletingId === d.id} onClick={() => handleDelete(d)} className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deletingId === d.id ? "..." : "Hapus"}</button></div></td>
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
                            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Diskon Ongkir</p><h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{editing ? "Edit" : "Buat baru"}</h2></div>
                            <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-76px)] overflow-y-auto">
                            <div className="space-y-5 px-6 py-6">
                                {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Nama</label><input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Kode (opsional)</label><input type="text" value={form.code} onChange={(e) => updateForm("code", e.target.value.toUpperCase())} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="ONGKIR50 — kosongkan untuk auto-apply" /></div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Tipe</label><select value={form.type} onChange={(e) => updateForm("type", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"><option value="PERCENTAGE">%</option><option value="FIXED">Rp</option></select></div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Nilai</label><input type="number" value={form.value} onChange={(e) => updateForm("value", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="1" /></div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Maks Diskon</label><input type="number" value={form.maxDiscount} onChange={(e) => updateForm("maxDiscount", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="0" placeholder="Opsional" /></div>
                                </div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Minimal Belanja (Rp)</label><input type="number" value={form.minPurchase} onChange={(e) => updateForm("minPurchase", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="0" placeholder="0 = tanpa minimal" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Mulai</label><input type="datetime-local" value={form.startAt} onChange={(e) => updateForm("startAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Selesai</label><input type="datetime-local" value={form.endAt} onChange={(e) => updateForm("endAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                </div>
                                <div className="flex items-center gap-3"><button type="button" onClick={() => updateForm("isActive", !form.isActive)} className={`relative h-6 w-11 rounded-full transition ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.isActive ? "left-[22px]" : "left-0.5"}`} /></button><span className="text-sm text-gray-700">{form.isActive ? "Aktif" : "Nonaktif"}</span></div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Batal</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">{saving ? "Menyimpan..." : editing ? "Simpan" : "Buat"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
