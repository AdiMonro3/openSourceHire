import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSourceHire",
  description: "Turn open-source contributions into income and hiring signal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
