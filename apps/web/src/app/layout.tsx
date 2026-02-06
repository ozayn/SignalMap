import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SignalMap",
  description: "Longitudinal studies of emotion, language, and interaction",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        <header className="border-b border-border bg-background">
          <div className="container mx-auto max-w-4xl px-4 py-4">
            <span className="font-semibold text-foreground">SignalMap</span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
