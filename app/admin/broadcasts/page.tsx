"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiMail, FiEye } from "react-icons/fi";

type Broadcast = {
    id: number; name: string; type: string; channel: string; subject: string | null;
    message: string; imageUrl: string | null; link: string | null;
    status: string; scheduledAt: string | null; sentAt: string | null;
    audienceCount: number; sentCount: number; failedCount: number; createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
    BEST_SELLER: "Produk Terlaris", NEW_PRODUCT: "Produk Baru", BUY_AGAIN: "Beli Lagi",
    INACTIVE_BUYER: "Pembeli Tidak Aktif", PRICE_DROP: "Harga Turun",
    CART_REMINDER: "Keranjang", CHECKOUT_REMINDER: "Reminder Checkout", THANK_YOU: "Terima Kasih",
};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

type FormState = {
    name: string; type: string; channel: string; subject: string; message: string;
    imageUrl: string; link: string; scheduledAt: string;
};

const emptyForm: FormState = { name: "", type: "BEST_SELLER", channel: "whatsapp", subject: "", message: "", imageUrl: "", link: "", scheduledAt: "" };

function formatDate(v: string) { return new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function statusLabel(s: string) { switch (s) { case "DRAFT": return "Draft"; case "SCHEDULED": return "Terjadwal"; case "SENDING": return "Mengirim..."; case "COMPLETED": return "Selesai"; case "FAILED": return "Gagal"; default: return s; } }
function statusColor(s: string) { switch (s) { case "COMPLETED": return "text-emerald-600"; case "SENDING": return "text-blue-600"; case "FAILED": return "text-red-600"; case "SCHEDULED": return "text-amber-600"; default: return "text-gray-400"; } }
async function readJson(r: Response) { const t = await r.text(); if (!t) throw new Error(`Server error ${r.status}`); try { return JSON.parse(t); } catch { throw new Error(`Invalid JSON ${r.status}`); } }

export default function AdminBroadcastsPage() {
    const [items, setItems] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Broadcast | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [audienceModal, setAudienceModal] = useState<{ broadcast: any; audienceCount: number; preview: any[] } | null>(null);
    const [audienceLoading, setAudienceLoading] = useState(false);

    async function load() { try { setLoading(true); const r = await fetch("/api/admin/broadcasts", { cache: "no-store" }); const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message); setItems(res.data?.items ?? []); } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat."); } finally { setLoading(false); } }
    useEffect(() => { load(); }, []);

    function openCreate() { setEditing(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); setModalOpen(true); }
    function openEdit(item: Broadcast) { setEditing(item); setForm({ name: item.name, type: item.type, channel: item.channel, subject: item.subject || "", message: item.message, imageUrl: item.imageUrl || "", link: item.link || "", scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : "" }); setError(""); setSuccess(""); setModalOpen(true); }
    function closeModal() { if (saving) return; setModalOpen(false); setEditing(null); setForm({ ...emptyForm }); setError(""); setSuccess(""); }
    function updateForm<K extends keyof FormState>(k: K, v: FormState[K]) { setForm((c) => ({ ...c, [k]: v })); }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault(); setError(""); setSuccess("");
        if (!form.name.trim()) { setError("Nama wajib diisi."); return; }
        if (!form.message.trim()) { setError("Pesan wajib diisi."); return; }
        try {
            setSaving(true);
            const payload: any = { name: form.name.trim(), type: form.type, channel: form.channel, subject: form.subject.trim() || null, message: form.message.trim(), imageUrl: form.imageUrl.trim() || null, link: form.link.trim() || null };
            if (form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
            const url = editing ? `/api/admin/broadcasts/${editing.id}` : "/api/admin/broadcasts";
            const r = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message);
            setSuccess(editing ? "Berhasil diubah." : "Berhasil dibuat."); await load(); window.setTimeout(closeModal, 700);
        } catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); } finally { setSaving(false); }
    }

    async function handleDelete(item: Broadcast) {
        if (!window.confirm(`Hapus "${item.name}"?`)) return;
        try { setDeletingId(item.id); const r = await fetch(`/api/admin/broadcasts/${item.id}`, { method: "DELETE" }); const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message); setSuccess("Berhasil dihapus."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus."); } finally { setDeletingId(null); }
    }

    const [sendingId, setSendingId] = useState<number | null>(null);

    async function handleSend(item: Broadcast) {
        if (!window.confirm(`Kirim broadcast "${item.name}" ke ${item.audienceCount} orang?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
        try {
            setSendingId(item.id); setError(""); setSuccess("");
            const r = await fetch(`/api/admin/broadcasts/${item.id}/send`, { method: "POST" });
            const res = await readJson(r);
            if (!r.ok || !res.success) throw new Error(res.message);
            setSuccess(res.message || "Broadcast berhasil dikirim.");
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : "Gagal mengirim."); } finally { setSendingId(null); }
    }

    async function previewAudience(item: Broadcast) {
        try { setAudienceLoading(true); setAudienceModal(null); const r = await fetch(`/api/admin/broadcasts/${item.id}/audience`); const res = await readJson(r); if (!r.ok || !res.success) throw new Error(res.message); setAudienceModal(res.data); } catch { setAudienceModal(null); } finally { setAudienceLoading(false); }
    }

    const filtered = items.filter((b) => !search.trim() || b.name.toLowerCase().includes(search.toLowerCase()) || (TYPE_LABELS[b.type] ?? "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><span>Admin</span><span>/</span><span className="text-gray-600">Broadcast</span></div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Broadcast</h1>
                        <p className="mt-1 text-sm text-gray-500">Kirim pesan pemasaran ke pelanggan berdasarkan segmen.</p>
                    </div>
                    <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800"><FiMail size={16} /> Buat Broadcast</button>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div><h2 className="text-sm font-semibold text-gray-950">Daftar Broadcast</h2><p className="mt-0.5 text-xs text-gray-400">{filtered.length} broadcast</p></div>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-gray-400 focus:bg-white md:w-72" />
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><FiMail size={24} className="text-gray-400" /><p className="mt-4 text-sm font-semibold text-gray-900">Belum ada broadcast</p><button type="button" onClick={openCreate} className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4">Buat sekarang</button></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead><tr className="border-b border-gray-200 bg-gray-50/80">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nama</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tipe</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Channel</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Audience</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dibuat</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((b) => (
                                        <tr key={b.id} className="group transition hover:bg-gray-50/70">
                                            <td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{b.name}</p>{b.subject && <p className="text-xs text-gray-400">{b.subject}</p>}</td>
                                            <td className="px-5 py-4"><span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{TYPE_LABELS[b.type] ?? b.type}</span></td>
                                            <td className="px-5 py-4"><span className="text-xs text-gray-600 capitalize">{b.channel}</span></td>
                                            <td className="px-5 py-4"><button type="button" onClick={() => previewAudience(b)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"><FiEye size={12} /> {b.audienceCount} orang</button></td>
                                            <td className="px-5 py-4"><span className={`text-xs font-medium ${statusColor(b.status)}`}>{statusLabel(b.status)}</span></td>
                                            <td className="px-5 py-4"><p className="text-xs text-gray-700">{formatDate(b.createdAt)}</p></td>
                                            <td className="px-5 py-4 text-right"><div className="flex justify-end gap-1">{(b.status === "DRAFT" || b.status === "SCHEDULED") && <button type="button" disabled={sendingId === b.id} onClick={() => handleSend(b)} className="px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50">{sendingId === b.id ? "Mengirim..." : "Kirim"}</button>}{b.status === "FAILED" && <button type="button" disabled={sendingId === b.id} onClick={() => handleSend(b)} className="px-2.5 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50">{sendingId === b.id ? "Mengirim..." : "Kirim Ulang"}</button>}<button type="button" onClick={() => openEdit(b)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100">Edit</button><button type="button" disabled={deletingId === b.id} onClick={() => handleDelete(b)} className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deletingId === b.id ? "..." : "Hapus"}</button></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* CREATE/EDIT MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[92vh] w-full max-w-xl overflow-hidden bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Broadcast</p><h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{editing ? "Edit broadcast" : "Buat broadcast baru"}</h2></div>
                            <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-76px)] overflow-y-auto">
                            <div className="space-y-5 px-6 py-6">
                                {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Nama Broadcast</label><input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="Contoh: Flash Sale Ramadhan" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Tipe</label><select value={form.type} onChange={(e) => updateForm("type", e.target.value)} disabled={!!editing} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400 disabled:opacity-50">{TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Channel</label><select value={form.channel} onChange={(e) => updateForm("channel", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></div>
                                </div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Subjek (opsional)</label><input type="text" value={form.subject} onChange={(e) => updateForm("subject", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Pesan *</label><textarea value={form.message} onChange={(e) => updateForm("message", e.target.value)} rows={5} className="w-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" placeholder="Gunakan {name} untuk nama pelanggan, {product} untuk nama produk, dll." /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">URL Gambar (opsional)</label><input type="url" value={form.imageUrl} onChange={(e) => updateForm("imageUrl", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="https://..." /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Link (opsional)</label><input type="url" value={form.link} onChange={(e) => updateForm("link", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="https://..." /></div>
                                <div><label className="mb-1.5 block text-xs font-semibold text-gray-700">Jadwal Kirim (opsional)</label><input type="datetime-local" value={form.scheduledAt} onChange={(e) => updateForm("scheduledAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" /><p className="mt-1 text-xs text-gray-400">Kosongkan untuk menyimpan sebagai draft.</p></div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Batal</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">{saving ? "Menyimpan..." : editing ? "Simpan" : "Buat Broadcast"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUDIENCE PREVIEW MODAL */}
            {audienceLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4"><div className="rounded-xl bg-white p-8 text-center shadow-2xl"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /><p className="mt-4 text-sm text-gray-600">Memuat audience...</p></div></div>
            )}
            {audienceModal && !audienceLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[80vh] w-full max-w-lg overflow-hidden bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Audience Preview</p><h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{audienceModal.broadcast.name}</h2><p className="mt-1 text-sm text-gray-500">{audienceModal.audienceCount} target ditemukan</p></div>
                            <button type="button" onClick={() => setAudienceModal(null)} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100">×</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-6">
                            {audienceModal.preview.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center">Tidak ada audience yang cocok.</p>
                            ) : (
                                <div className="space-y-2">
                                    {audienceModal.preview.map((m: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                                            <div><p className="text-sm font-medium text-gray-900">{m.name || "User #" + m.userId.slice(0, 8)}</p><p className="text-xs text-gray-400">{m.phone}</p></div>
                                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">{m.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {audienceModal.audienceCount > 50 && <p className="mt-4 text-center text-xs text-gray-400">Menampilkan 50 dari {audienceModal.audienceCount} audience</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
