import "./globals.css";

import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/providers/AuthProvider";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import { DialogProvider } from "@/components/ui/Dialog";
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
          <DialogProvider>

          {children}

          <Footer />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
            }}
          />

          </DialogProvider>
        </AuthProvider>

      </body>
    </html>
  );
}