import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CheckoutPage from "./CheckoutPage";

export default async function Checkout() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/checkout");
    }

    return <CheckoutPage />;
}