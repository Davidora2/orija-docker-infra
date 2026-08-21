import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS — Your Personal Chief of Staff",
  description:
    "Choose fewer, more valuable priorities and build a plan that fits your real capacity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
