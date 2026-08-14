import { auth } from "@/auth";
import CartPage from "@/components/cart/CartPage";
import BottomNavbar from "@/components/products/BottomNavbar";
import { ProductProvider } from "@/components/products/ProductContext";

export default async function Cart() {
    const session = await auth();
    return (
        <ProductProvider>
            {session?.user && (
            <><CartPage /><BottomNavbar /></>
            )}

        </ProductProvider>
    );
}