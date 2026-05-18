import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { resolveSignalMapSupportHref } from "@/lib/site-support-href";
import { SuppressDevLogs } from "@/components/suppress-dev-logs";
import { Analytics } from "@/components/analytics";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", preload: false });

/**
 * Support href must be resolved with **runtime** `process.env` (e.g. Railway / Stripe URL).
 * Without this, the root layout can be generated at build time and bake in the GitHub fallback.
 * `ENABLE_SUPPORT_URL_DEBUG` does not affect this — it only gates `/debug/support-url`.
 */
export const dynamic = "force-dynamic";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "https://signalmap.ozayn.com";
  return raw.replace(/\/+$/, "");
}

const SITE_URL = resolveSiteUrl();
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;

export const metadata: Metadata = {
  title: "SignalMap",
  description: "Research-style dashboard for exploring economic, geopolitical, historical, and platform signals over time.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "SignalMap",
    description: "Research-style dashboard for exploring economic, geopolitical, historical, and platform signals over time.",
    url: SITE_URL,
    siteName: "SignalMap",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalMap",
    description: "Research-style dashboard for exploring economic, geopolitical, historical, and platform signals over time.",
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supportHref = resolveSignalMapSupportHref();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <div className="flex min-h-screen w-full flex-col">
            <SuppressDevLogs />
            {gaId && <Analytics gaId={gaId} />}
            <Navbar supportHref={supportHref} />
            <main className="main-content min-w-0 overflow-x-hidden">{children}</main>
            <SiteFooter supportHref={supportHref} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
