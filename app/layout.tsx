import "./globals.css";

import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/providers/AuthProvider";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import Footer from "@/components/Footer";

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

          <Footer />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
            }}
          />

        </AuthProvider>

      </body>
    </html>
  );
}