"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/studies", label: "Studies" },
  { href: "/explore", label: "Explore" },
  { href: "/methods", label: "Methods" },
  { href: "/learning", label: "Learning" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="nav-container">
        <div className="nav-left">
          <Link href="/" className="logo">
            SignalMap
          </Link>
          <nav className="nav-links">
            {navLinks.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={isActive ? "nav-link-active" : ""}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="nav-right">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
