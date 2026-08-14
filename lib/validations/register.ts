import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter"),

    email: z
      .string()
      .email("Email tidak valid")
      .optional()
      .or(z.literal("")),

    phone: z
      .string()
      .optional()
      .or(z.literal("")),

    password: z
      .string()
      .min(6, "Password minimal 6 karakter"),

    confirmPassword: z
      .string()
      .min(6, "Konfirmasi password wajib diisi"),

    referralCode: z
      .string()
      .optional(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Password tidak sama",
      path: ["confirmPassword"],
    }
  )
  .refine(
    (data) => data.email || data.phone,
    {
      message: "Email atau nomor HP wajib diisi",
      path: ["email"],
    }
  );

export type RegisterInput = z.infer<typeof registerSchema>;