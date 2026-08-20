import "./globals.css";

import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/providers/AuthProvider";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import Script from "next/script";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>

        <AuthProvider>
          <AnalyticsProvider />

          {children}

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
            }}
          />

        </AuthProvider>

      </body>
      <Script
        src={
          process.env.MIDTRANS_IS_PRODUCTION ===
            "true"
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js"
        }
        data-client-key={
          process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
        }
        strategy="afterInteractive"
      />
    </html>
  );
}