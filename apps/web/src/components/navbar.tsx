"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUPPORT_LINK_ARIA } from "@/lib/site-support";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/studies", label: "Studies" },
  { href: "/explore", label: "Explore" },
  { href: "/methods", label: "Methods" },
  { href: "/learning", label: "Learning" },
];

function NavLink({
  href,
  label,
  isActive,
  onClick,
  mobile,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${isActive ? "nav-link-active" : ""} ${mobile ? "block py-3 px-2 -mx-2 rounded-md hover:bg-muted/50 min-h-[44px] flex items-center" : ""}`}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export function Navbar({ supportHref }: { supportHref: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setMobileOpen(false);
    hamburgerRef.current?.focus();
  };

  useEffect(() => {
    setMobileOpen(false);
    hamburgerRef.current?.focus();
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="site-header">
      <div className="nav-container">
        <div className="nav-left flex-1 min-w-0 flex items-center gap-2 md:gap-7">
          <Link href="/" className="logo shrink-0">
            SignalMap
          </Link>
          <nav className="nav-links hidden md:flex flex-wrap gap-x-3 gap-y-1 md:gap-x-5">
            {navLinks.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <NavLink key={href} href={href} label={label} isActive={isActive} />
              );
            })}
          </nav>
        </div>
        <div className="nav-right flex items-center gap-1 sm:gap-2 shrink-0">
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-support-btn max-[380px]:px-2 max-[380px]:py-1 max-[380px]:text-[11px]"
            lang="en"
            aria-label={SUPPORT_LINK_ARIA}
          >
            Support
          </a>
          <ThemeToggle />
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex md:hidden p-2 -mr-2 rounded-md text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring items-center justify-center"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <svg
              className="w-6 h-6 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay and panel */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-200 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={closeMenu}
        />
        <div
          className={`absolute top-0 right-0 w-full max-w-xs h-full bg-background border-l border-border shadow-xl flex flex-col transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-semibold text-foreground">Menu</span>
            <button
              type="button"
              onClick={closeMenu}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col p-4 gap-0 overflow-auto">
            {navLinks.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  isActive={isActive}
                  onClick={closeMenu}
                  mobile
                />
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
