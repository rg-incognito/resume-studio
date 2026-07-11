"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { signOutUser } from "@/lib/firebase-client";

const NAV = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/generate", label: "Generate" },
  { href: "/dashboard/ats-check", label: "ATS Check" },
  { href: "/dashboard/versions", label: "Versions" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-display text-lg tracking-tight">
            Resume Studio
          </Link>
          <nav className="hidden items-center gap-6 font-sans text-sm sm:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "font-medium text-ink"
                      : "text-ink-muted transition-colors hover:text-ink"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden font-sans text-sm text-ink-muted sm:inline">
              {user.displayName ?? user.email}
            </span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="font-sans text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto border-t border-hairline px-6 py-2.5 font-sans text-sm sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname.startsWith(item.href) ? "font-medium text-ink" : "text-ink-muted"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
