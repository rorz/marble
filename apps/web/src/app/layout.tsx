import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: [
    "latin",
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: [
    "latin",
  ],
});

export const metadata: Metadata = {
  title: "Marble",
  description: "Composable tables and programs for fast internal tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-stone-950 text-stone-50">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
