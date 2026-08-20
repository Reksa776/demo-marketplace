export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/products/:path*",
    "/dashboard/:path*",
    "/seller/:path*",
    "/admin/:path*",
  ],
};