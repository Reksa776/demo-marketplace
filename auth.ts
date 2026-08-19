import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const {
    handlers,
    auth,
    signIn,
    signOut,
} = NextAuth({
    adapter: PrismaAdapter(prisma),

    session: {
        strategy: "jwt",
    },

    pages: {
        signIn: "/login",
    },

    providers: [
        /*
         * GOOGLE
         */
        Google({
            clientId:
                process.env.GOOGLE_CLIENT_ID!,

            clientSecret:
                process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),

        /*
         * CREDENTIALS
         */
        Credentials({
            name: "Credentials",

            credentials: {
                identifier: {
                    label: "Email / Nomor HP",
                    type: "text",
                },

                password: {
                    label: "Password",
                    type: "password",
                },
            },

            async authorize(credentials) {
                /*
                 * Pastikan identifier dan password
                 * dikirim dari form login.
                 */
                if (
                    !credentials?.identifier ||
                    !credentials?.password
                ) {
                    return null;
                }

                const identifier =
                    String(
                        credentials.identifier
                    ).trim();

                const password =
                    String(
                        credentials.password
                    );

                /*
                 * Cari user berdasarkan:
                 *
                 * email ATAU nomor HP
                 */
                const user =
                    await prisma.user.findFirst({
                        where: {
                            OR: [
                                {
                                    email: identifier,
                                },
                                {
                                    phone: identifier,
                                },
                            ],
                        },
                    });

                /*
                 * User tidak ditemukan
                 */
                if (!user) {
                    return null;
                }

                /*
                 * User tidak mempunyai password.
                 *
                 * Biasanya bisa terjadi pada user
                 * yang dibuat melalui OAuth/Google.
                 */
                if (!user.password) {
                    return null;
                }

                /*
                 * Verifikasi password
                 */
                const valid =
                    await verifyPassword(
                        password,
                        user.password
                    );

                if (!valid) {
                    return null;
                }

                /*
                 * User berhasil login.
                 *
                 * Role ikut dikirim supaya nanti
                 * bisa dimasukkan ke JWT/session.
                 */
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                };
            },
        }),
    ],

    callbacks: {
        /*
         * SIGN IN
         *
         * Credentials:
         * langsung izinkan jika authorize()
         * berhasil.
         *
         * Google:
         * izinkan login selama Google memberikan
         * email.
         */
        async signIn({
            user,
            account,
        }) {
            /*
             * Credentials login
             */
            if (
                account?.provider !==
                "google"
            ) {
                return true;
            }

            /*
             * Google harus memberikan email.
             */
            if (!user.email) {
                return false;
            }

            /*
             * Cek apakah email Google sudah
             * mempunyai user di database.
             *
             * Untuk sekarang kita tidak melakukan
             * blokir berdasarkan existingUser.
             */
            const existingUser =
                await prisma.user.findUnique({
                    where: {
                        email: user.email,
                    },
                });

            /*
             * User belum ada.
             *
             * PrismaAdapter akan menangani
             * pembuatan user/account OAuth.
             */
            if (!existingUser) {
                return true;
            }

            return true;
        },

        /*
         * JWT
         *
         * Simpan ID dan ROLE user ke token.
         */
        async jwt({
            token,
            user,
        }) {
            if (user) {
                token.id =
                    (user as any).id;

                token.role =
                    (user as any).role;
            }

            return token;
        },

        /*
         * SESSION
         *
         * Masukkan ID dan ROLE dari JWT
         * ke session.user.
         */
        async session({
            session,
            token,
        }) {
            if (session.user) {
                (session.user as any).id =
                    token.id;

                (session.user as any).role =
                    token.role;
            }

            return session;
        },
    },
});