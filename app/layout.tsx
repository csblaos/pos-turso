import type { Metadata, Viewport } from "next";

import { ClientPerfVitals } from "@/components/app/client-perf-vitals";
import { AppToaster } from "@/components/ui/app-toaster";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { getRequestUiLocale } from "@/lib/i18n/request-locale";

import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS POS",
  description: "ระบบขายหน้าร้านแบบ SaaS",
  applicationName: "SaaS POS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SaaS POS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showPerfVitals = process.env.NEXT_PUBLIC_PERF_DEBUG === "1";
  const session = await getSession();
  const htmlLang = session?.uiLocale ?? (await getRequestUiLocale()) ?? DEFAULT_UI_LOCALE;

  return (
    <html lang={htmlLang}>
      <body className="bg-white font-sans antialiased">
        <div className="min-h-dvh bg-white min-[1200px]:px-4">{children}</div>
        <AppToaster />
        {showPerfVitals ? <ClientPerfVitals /> : null}
      </body>
    </html>
  );
}
