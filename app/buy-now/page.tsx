import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BuyNowPage from "./BuyNowPage";

type Props = {
    searchParams: Promise<{
        productId?: string;
        variantId?: string;
        quantity?: string;
    }>;
};

export default async function BuyNow(
    { searchParams }: Props
) {
    const session = await auth();

    if (!session?.user) {
        redirect(
            "/login?callbackUrl=/buy-now"
        );
    }

    const params =
        await searchParams;

    if (
        !params.productId ||
        !params.variantId
    ) {
        redirect("/");
    }

    return (
        <BuyNowPage
            productId={params.productId}
            variantId={params.variantId}
            quantity={
                params.quantity ?? "1"
            }
        />
    );
}