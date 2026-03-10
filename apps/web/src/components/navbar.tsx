"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/studies", label: "Studies" },
  { href: "/explore", label: "Explore" },
  { href: "/methods", label: "Methods" },
  { href: "/learning", label: "Learning", subtle: true },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="navbar-header">
      <nav className="navbar-inner">
        <div className="flex items-center">
          <Link href="/" className="navbar-logo">
            SignalMap
          </Link>
          <div className="flex items-center ml-5">
            {navLinks.map(({ href, label, subtle }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`navbar-link ${isActive ? "navbar-link-active" : ""} ${subtle ? "navbar-link-subtle" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}
