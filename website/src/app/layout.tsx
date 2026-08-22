import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import "./globals.css";

const bodyFont = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
});

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Coffee Break GV",
  description: "Menu del giorno, asporto e consegna in ospedale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable}`}
      lang="it"
    >
      <body>{children}</body>
    </html>
  );
}
