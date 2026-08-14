import { auth } from "@/auth";
import OrdersPage from "@/components/orders/OrdersPage";
import BottomNavbar from "@/components/products/BottomNavbar";
import { ProductProvider } from "@/components/products/ProductContext";

export default async function Orders() {
    const session = await auth();
    return (
        <ProductProvider>
            {session?.user && (
            <><OrdersPage /><BottomNavbar /></>
            )}
        </ProductProvider>
    );
}   