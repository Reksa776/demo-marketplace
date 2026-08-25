"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiTarget, FiPlus, FiTrash2, FiZap } from "react-icons/fi";

type Reward = {
    id?: number;
    name: string;
    type: string;
    value: number;
    maxDiscount: number | null;
    weight: number;
    totalQuantity: number | null;
    usedQuantity: number;
    isActive: boolean;
};

type Campaign = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    minimumSpend: number;
    maxSpinsPerUser: number;
    startAt: string;
    endAt: string;
    isActive: boolean;
    createdAt: string;
    spinCount: number;
    rewards: Reward[];
};

type FormState = {
    name: string;
    description: string;
    minimumSpend: string;
    maxSpinsPerUser: string;
    startAt: string;
    endAt: string;
    isActive: boolean;
    rewards: Reward[];
};

const emptyForm: FormState = {
    name: "",
    description: "",
    minimumSpend: "100000",
    maxSpinsPerUser: "1",
    startAt: "",
    endAt: "",
    isActive: true,
    rewards: [
        { name: "Diskon 5%", type: "PERCENTAGE", value: 5, maxDiscount: null, weight: 40, totalQuantity: null, usedQuantity: 0, isActive: true },
        { name: "Diskon 10%", type: "PERCENTAGE", value: 10, maxDiscount: null, weight: 20, totalQuantity: null, usedQuantity: 0, isActive: true },
        { name: "Diskon Rp25.000", type: "FIXED", value: 25000, maxDiscount: null, weight: 10, totalQuantity: 100, usedQuantity: 0, isActive: true },
        { name: "Gratis Ongkir", type: "FREE_SHIPPING", value: 0, maxDiscount: null, weight: 20, totalQuantity: null, usedQuantity: 0, isActive: true },
        { name: "Coba Lagi", type: "ZONK", value: 0, maxDiscount: null, weight: 10, totalQuantity: null, usedQuantity: 0, isActive: true },
    ],
};

function formatRupiah(value: number) {
    return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function toDateTimeLocal(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function rewardTypeLabel(type: string) {
    switch (type) {
        case "PERCENTAGE": return "Persen (%)";
        case "FIXED": return "Fixed (Rp)";
        case "FREE_SHIPPING": return "Gratis Ongkir";
        case "CASHBACK": return "Cashback";
        case "ZONK": return "Coba Lagi";
        default: return type;
    }
}

async function readJsonResponse(response: Response) {
    const text = await response.text();
    if (!text) throw new Error(`Server error. Status: ${response.status}`);
    try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON. Status: ${response.status}`); }
}

export default function AdminSpinWheelPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Campaign | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function loadCampaigns() {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/spin-wheel/campaigns", { cache: "no-store" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil data.");
            setCampaigns(result.data?.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadCampaigns(); }, []);

    function openCreateModal() {
        setEditingItem(null);
        setForm({ ...emptyForm });
        setError(""); setSuccess(""); setModalOpen(true);
    }

    function openEditModal(item: Campaign) {
        setEditingItem(item);
        setForm({
            name: item.name,
            description: item.description || "",
            minimumSpend: String(item.minimumSpend),
            maxSpinsPerUser: String(item.maxSpinsPerUser),
            startAt: toDateTimeLocal(item.startAt),
            endAt: toDateTimeLocal(item.endAt),
            isActive: item.isActive,
            rewards: item.rewards.map((r) => ({ ...r })),
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

    function updateReward(index: number, field: keyof Reward, value: any) {
        setForm((c) => {
            const rewards = [...c.rewards];
            rewards[index] = { ...rewards[index], [field]: value };
            return { ...c, rewards };
        });
    }

    function addReward() {
        setForm((c) => ({
            ...c,
            rewards: [
                ...c.rewards,
                { name: "", type: "PERCENTAGE", value: 5, maxDiscount: null, weight: 10, totalQuantity: null, usedQuantity: 0, isActive: true },
            ],
        }));
    }

    function removeReward(index: number) {
        setForm((c) => ({
            ...c,
            rewards: c.rewards.filter((_, i) => i !== index),
        }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(""); setSuccess("");

        if (!form.name.trim()) { setError("Nama campaign wajib diisi."); return; }
        if (!form.startAt || !form.endAt) { setError("Tanggal wajib diisi."); return; }
        if (new Date(form.endAt) <= new Date(form.startAt)) { setError("Tanggal selesai harus setelah tanggal mulai."); return; }
        if (form.rewards.length === 0) { setError("Minimal harus ada 1 reward."); return; }

        // Validate rewards
        for (const r of form.rewards) {
            if (!r.name.trim()) { setError("Nama reward wajib diisi."); return; }
            if (r.type !== "ZONK" && (!Number.isFinite(r.value) || r.value <= 0)) {
                setError(`Nilai reward "${r.name}" harus lebih dari 0.`);
                return;
            }
            if (!Number.isInteger(r.weight) || r.weight < 1) {
                setError(`Weight reward "${r.name}" harus bilangan bulat >= 1.`);
                return;
            }
        }

        try {
            setSaving(true);
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                minimumSpend: Number(form.minimumSpend),
                maxSpinsPerUser: Number(form.maxSpinsPerUser),
                startAt: new Date(form.startAt).toISOString(),
                endAt: new Date(form.endAt).toISOString(),
                isActive: form.isActive,
                rewards: form.rewards.map((r) => ({
                    id: r.id,
                    name: r.name.trim(),
                    type: r.type,
                    value: r.type === "ZONK" ? 0 : r.value,
                    maxDiscount: r.maxDiscount,
                    weight: r.weight,
                    totalQuantity: r.totalQuantity,
                    isActive: r.isActive,
                })),
            };

            const url = editingItem
                ? `/api/admin/spin-wheel/campaigns/${editingItem.id}`
                : "/api/admin/spin-wheel/campaigns";
            const method = editingItem ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan.");

            setSuccess(editingItem ? "Campaign berhasil diubah." : "Campaign berhasil dibuat.");
            await loadCampaigns();
            window.setTimeout(closeModal, 700);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(item: Campaign) {
        try {
            setError(""); setSuccess("");
            const response = await fetch(`/api/admin/spin-wheel/campaigns/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !item.isActive }),
            });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengubah status.");
            await loadCampaigns();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengubah status.");
        }
    }

    async function handleDelete(item: Campaign) {
        if (!window.confirm(`Hapus campaign "${item.name}"?`)) return;
        try {
            setError(""); setSuccess("");
            const response = await fetch(`/api/admin/spin-wheel/campaigns/${item.id}`, { method: "DELETE" });
            const result = await readJsonResponse(response);
            if (!response.ok || !result.success) throw new Error(result.message || "Gagal menghapus.");
            setSuccess("Campaign berhasil dihapus.");
            await loadCampaigns();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menghapus.");
        }
    }

    const filtered = campaigns.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>Admin</span><span>/</span><span className="text-gray-600">Spin Wheel</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Spin Wheel Promo</h1>
                        <p className="mt-1 text-sm text-gray-500">Kelola kampanye spin wheel promo untuk customer.</p>
                    </div>
                    <button type="button" onClick={openCreateModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800">
                        <FiTarget size={16} /> Tambah Campaign
                    </button>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-950">Daftar Campaign</h2>
                            <p className="mt-0.5 text-xs text-gray-400">{filtered.length} campaign</p>
                        </div>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari campaign..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-gray-400 focus:bg-white md:w-72" />
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                            <FiTarget size={24} className="text-gray-400" />
                            <p className="mt-4 text-sm font-semibold text-gray-900">Belum ada campaign spin wheel</p>
                            <button type="button" onClick={openCreateModal} className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4">Buat campaign</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50/80">
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nama</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Min. Belanja</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rewards</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Periode</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Spin</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((c) => (
                                        <tr key={c.id} className="group transition hover:bg-gray-50/70">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                                                <p className="text-xs text-gray-400">/{c.slug}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium text-gray-900">{formatRupiah(c.minimumSpend)}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm text-gray-700">{c.rewards.length} reward</p>
                                                <p className="text-xs text-gray-400">Max {c.maxSpinsPerUser}x spin/user</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-xs text-gray-700">{formatDate(c.startAt)}</p>
                                                <p className="text-xs text-gray-400">s/d {formatDate(c.endAt)}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium text-gray-900">{c.spinCount}</p>
                                                <p className="text-xs text-gray-400">total spin</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button type="button" onClick={() => handleToggleActive(c)} className="inline-flex items-center gap-2 text-xs font-medium">
                                                    <span className={`h-2 w-2 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                                                    <span className={c.isActive ? "text-emerald-700" : "text-gray-400"}>{c.isActive ? "Aktif" : "Nonaktif"}</span>
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button type="button" onClick={() => openEditModal(c)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100">Edit</button>
                                                    <button type="button" disabled={c.spinCount > 0} onClick={() => handleDelete(c)} className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent">
                                                        Hapus
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Spin Wheel</p>
                                <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">{editingItem ? "Edit campaign" : "Buat campaign baru"}</h2>
                            </div>
                            <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-76px)] overflow-y-auto">
                            <div className="space-y-5 px-6 py-6">
                                {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Nama Campaign</label>
                                    <input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" placeholder="Contoh: Ramadan Spin Wheel" />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Deskripsi</label>
                                    <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} className="h-20 w-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" placeholder="Deskripsi campaign (opsional)" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Minimum Belanja (Rp)</label>
                                        <input type="number" value={form.minimumSpend} onChange={(e) => updateForm("minimumSpend", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="0" step="1000" />
                                        <p className="mt-1 text-[11px] text-gray-400">Total subtotal order yang sudah dibayar</p>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Max Spin per User</label>
                                        <input type="number" value={form.maxSpinsPerUser} onChange={(e) => updateForm("maxSpinsPerUser", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" min="1" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal Mulai</label>
                                        <input type="datetime-local" value={form.startAt} onChange={(e) => updateForm("startAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tanggal Selesai</label>
                                        <input type="datetime-local" value={form.endAt} onChange={(e) => updateForm("endAt", e.target.value)} className="h-10 w-full border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => updateForm("isActive", !form.isActive)} className={`relative h-6 w-11 rounded-full transition ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}>
                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.isActive ? "left-[22px]" : "left-0.5"}`} />
                                    </button>
                                    <span className="text-sm text-gray-700">{form.isActive ? "Aktif" : "Nonaktif"}</span>
                                </div>

                                {/* REWARDS */}
                                <div className="border-t border-gray-200 pt-5">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900">Rewards ({form.rewards.length})</h3>
                                        <button type="button" onClick={addReward} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
                                            <FiPlus size={14} /> Tambah Reward
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {form.rewards.map((r, idx) => (
                                            <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-gray-500">Reward #{idx + 1}</span>
                                                    <button type="button" onClick={() => removeReward(idx)} className="text-gray-400 transition hover:text-red-500">
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                    <div className="col-span-2 sm:col-span-2">
                                                        <label className="mb-1 block text-[11px] font-medium text-gray-500">Nama</label>
                                                        <input type="text" value={r.name} onChange={(e) => updateReward(idx, "name", e.target.value)} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400" placeholder="Diskon 5%" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1 block text-[11px] font-medium text-gray-500">Tipe</label>
                                                        <select value={r.type} onChange={(e) => updateReward(idx, "type", e.target.value)} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400">
                                                            <option value="PERCENTAGE">Persen (%)</option>
                                                            <option value="FIXED">Fixed (Rp)</option>
                                                            <option value="FREE_SHIPPING">Gratis Ongkir</option>
                                                            <option value="CASHBACK">Cashback</option>
                                                            <option value="ZONK">Coba Lagi</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-1 block text-[11px] font-medium text-gray-500">Weight</label>
                                                        <input type="number" value={r.weight} onChange={(e) => updateReward(idx, "weight", Number(e.target.value))} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400" min="1" />
                                                    </div>
                                                    {r.type !== "ZONK" && r.type !== "FREE_SHIPPING" && (
                                                        <>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-medium text-gray-500">Nilai</label>
                                                                <input type="number" value={r.value} onChange={(e) => updateReward(idx, "value", Number(e.target.value))} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400" min="0" />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-medium text-gray-500">Max Diskon</label>
                                                                <input type="number" value={r.maxDiscount ?? ""} onChange={(e) => updateReward(idx, "maxDiscount", e.target.value ? Number(e.target.value) : null)} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400" min="0" placeholder="Tidak terbatas" />
                                                            </div>
                                                        </>
                                                    )}
                                                    <div>
                                                        <label className="mb-1 block text-[11px] font-medium text-gray-500">Total Qty</label>
                                                        <input type="number" value={r.totalQuantity ?? ""} onChange={(e) => updateReward(idx, "totalQuantity", e.target.value ? Number(e.target.value) : null)} className="h-9 w-full border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-gray-400" min="0" placeholder="Tidak terbatas" />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <button type="button" onClick={() => updateReward(idx, "isActive", !r.isActive)} className={`flex items-center gap-1.5 text-[11px] font-medium ${r.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                                                            <span className={`h-2 w-2 rounded-full ${r.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                                                            {r.isActive ? "Aktif" : "Off"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Batal</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">{saving ? "Menyimpan..." : editingItem ? "Simpan" : "Buat Campaign"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
