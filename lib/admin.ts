import { auth } from "@/auth";

export async function requireAdmin() {
    const session = await auth();

    if (!session?.user) {
        throw new Error("UNAUTHORIZED");
    }

    const role = (session.user as any).role;

    if (role !== "ADMIN") {
        throw new Error("FORBIDDEN");
    }

    return session;
}