import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: [
    "latin",
  ],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: [
    "latin",
  ],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description: "Composable tables and programs for fast internal tools.",
  title: "Marble",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="en"
    >
      <body className="min-h-full bg-stone-950 text-stone-50">{children}</body>
    </html>
  );
}
