import AdminAffiliateDetail from "@/components/admin/affiliate/AdminAffiliateDetail";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
    const { id } = await params;
    return <AdminAffiliateDetail id={id} />;
}
