import { Suspense } from "react";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-500">Memuat...</p>
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </main>
  );
}