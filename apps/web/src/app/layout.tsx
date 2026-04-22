import { MarbleToaster } from "@marble/ui";
import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: [
    "latin",
  ],
  variable: "--font-geist-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: [
    "latin",
  ],
  variable: "--font-jetbrains-mono",
});

const manrope = Manrope({
  subsets: [
    "latin",
  ],
  variable: "--font-manrope",
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
      className={`${geistSans.variable} ${jetBrainsMono.variable} ${manrope.variable} h-full antialiased`}
      lang="en"
    >
      <body className="min-h-full bg-stone-950 text-stone-50">
        {children}
        <MarbleToaster />
      </body>
    </html>
  );
}
