import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoupleTab · split the weekend bill, couple-aware",
  description: "Snap every receipt, tap who had what, and settle up between couples and singles in one message.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
