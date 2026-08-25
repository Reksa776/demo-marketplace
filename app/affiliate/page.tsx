import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AffiliateContent from "./AffiliateContent";

export default async function AffiliatePage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    return <AffiliateContent />;
}
