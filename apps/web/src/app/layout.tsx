import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SignalMap",
  description: "Longitudinal studies of emotion, language, and interaction",
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/svg+xml" }],
  },
};

const navLinks = [
  { href: "/studies", label: "Studies" },
  { href: "/explore", label: "Explore" },
  { href: "/methods", label: "Methods" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <header className="border-b border-border bg-background">
            <nav className="container mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link
                  href="/"
                  className="font-medium text-foreground hover:text-muted-foreground transition"
                >
                  SignalMap
                </Link>
                <div className="flex items-center gap-1">
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="text-sm text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded-md px-3 py-1.5 transition"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <ThemeToggle />
            </nav>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
