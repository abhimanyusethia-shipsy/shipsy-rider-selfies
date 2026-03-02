"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; username: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data);
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3"
      style={{ backgroundColor: "var(--color-navy)" }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger button - mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden text-white p-1 -ml-1 cursor-pointer"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <img src="/shipsy-logo.png" alt="Shipsy" width={32} height={32} />
        <h1 className="text-white text-base md:text-lg font-semibold tracking-wide">
          Rider Verification
        </h1>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        {user && (
          <>
            <span className="text-gray-300 text-xs md:text-sm hidden sm:inline">{user.displayName}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-xs md:text-sm transition-colors cursor-pointer"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
