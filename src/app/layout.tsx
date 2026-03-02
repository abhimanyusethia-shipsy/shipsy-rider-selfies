import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rider Verification | Shipsy",
  description: "Rider selfie verification dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
