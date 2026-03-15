import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { SuppressDevLogs } from "@/components/suppress-dev-logs";
import { Analytics } from "@/components/analytics";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", preload: false });

export const metadata: Metadata = {
  title: "SignalMap",
  description: "Longitudinal studies of emotion, language, and interaction",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', { debug_mode: ${process.env.NEXT_PUBLIC_GA_DEBUG === "true" ? "true" : "false"} });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <SuppressDevLogs />
          {gaId && <Analytics gaId={gaId} />}
          <Navbar />
          <main className="main-content min-w-0 overflow-x-hidden">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
