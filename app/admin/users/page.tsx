"use client";

import { useEffect, useState } from "react";
import { FiUsers } from "react-icons/fi";

type User = {
    id: string; name: string | null; email: string | null; phone: string | null;
    role: string; createdAt: string;
    _count?: { orders: number; addresses: number };
};

async function readJson(r: Response) { const t = await r.text(); if (!t) throw new Error(`Server error ${r.status}`); try { return JSON.parse(t); } catch { throw new Error(`Invalid JSON ${r.status}`); } }

function formatDate(v: string) { return new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
function roleLabel(r: string) { switch (r) { case "ADMIN": return "Admin"; case "SELLER": return "Seller"; case "AFFILIATOR": return "Affiliator"; default: return "Customer"; } }
function roleColor(r: string) { switch (r) { case "ADMIN": return "bg-purple-50 text-purple-700"; case "SELLER": return "bg-blue-50 text-blue-700"; case "AFFILIATOR": return "bg-amber-50 text-amber-700"; default: return "bg-gray-100 text-gray-600"; } }

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    async function load() {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (search.trim()) params.set("search", search.trim());
            const r = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
            const res = await readJson(r);
            if (!r.ok || !res.success) throw new Error(res.message || "Gagal mengambil data.");
            setUsers(res.data?.items ?? []);
            setTotal(res.data?.pagination?.total ?? 0);
        } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat."); } finally { setLoading(false); }
    }

    useEffect(() => { load(); }, [page]);

    function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(); }

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><span>Admin</span><span>/</span><span className="text-gray-600">Pengguna</span></div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-950">Pengguna</h1>
                    <p className="mt-1 text-sm text-gray-500">Daftar pengguna terdaftar.</p>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <section className="overflow-hidden border border-gray-200 bg-white">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div><h2 className="text-sm font-semibold text-gray-950">Daftar Pengguna</h2><p className="mt-0.5 text-xs text-gray-400">{total} pengguna</p></div>
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama/email/telepon..." className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-gray-400 focus:bg-white md:w-72" />
                            <button type="submit" className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800">Cari</button>
                        </form>
                    </div>

                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" /></div>
                    ) : users.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><FiUsers size={24} className="text-gray-400" /><p className="mt-4 text-sm font-semibold text-gray-900">Tidak ada pengguna ditemukan</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left">
                                <thead><tr className="border-b border-gray-200 bg-gray-50/80">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nama</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Telepon</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Role</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Bergabung</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Orders</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map((u) => (
                                        <tr key={u.id} className="group transition hover:bg-gray-50/70">
                                            <td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{u.name || "Tanpa nama"}</p><p className="text-xs text-gray-400">{u.id.slice(0, 8)}...</p></td>
                                            <td className="px-5 py-4"><p className="text-sm text-gray-700">{u.email || "-"}</p></td>
                                            <td className="px-5 py-4"><p className="text-sm text-gray-700">{u.phone || "-"}</p></td>
                                            <td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs font-medium ${roleColor(u.role)}`}>{roleLabel(u.role)}</span></td>
                                            <td className="px-5 py-4"><p className="text-xs text-gray-700">{formatDate(u.createdAt)}</p></td>
                                            <td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{u._count?.orders ?? 0}</p></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {total > limit && (
                        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
                            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Sebelumnya</button>
                            <span className="text-xs text-gray-500">Halaman {page} / {Math.ceil(total / limit)}</span>
                            <button type="button" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Selanjutnya</button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
