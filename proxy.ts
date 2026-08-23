import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const pathname = req.nextUrl.pathname;

    const protectedRoutes = [
        "/profile",
        "/wishlist",
        "/cart",
        "/checkout",
        "/buy-now",
        "/orders",
        "/address",
        "/addresses",
        "/admin",
        "/dashboard",
        "/seller",
    ];

    const isProtected = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );

    if (!isLoggedIn && isProtected) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set(
            "callbackUrl",
            pathname
        );
        return Response.redirect(loginUrl);
    }
});

export const config = {
    matcher: [
        "/profile/:path*",
        "/wishlist/:path*",
        "/cart/:path*",
        "/checkout/:path*",
        "/buy-now/:path*",
        "/orders/:path*",
        "/address/:path*",
        "/addresses/:path*",
        "/admin/:path*",
        "/dashboard/:path*",
        "/seller/:path*",
        // /products is public but needs session context for auth-aware rendering
        "/products/:path*",
    ],
};