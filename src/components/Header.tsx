"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
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
      className="flex items-center justify-between px-6 py-3"
      style={{ backgroundColor: "var(--color-navy)" }}
    >
      <div className="flex items-center gap-3">
        <img src="/shipsy-logo.png" alt="Shipsy" width={32} height={32} />
        <h1 className="text-white text-lg font-semibold tracking-wide">
          Rider Verification
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-gray-300 text-sm">{user.displayName}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
