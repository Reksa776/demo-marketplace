import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileContent from "./ProfileContent";

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            name: true,
            email: true,
            phone: true,
        },
    });

    if (!user) {
        redirect("/login");
    }

    return <ProfileContent user={user} />;
}
