import type { Metadata } from "next";
import { connection } from "next/server";
import { Inter, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { CursorFollower } from "@/components/ui/CursorFollower";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

// Mêmes polices et même chargement que Portfolio2026.
const clashDisplay = localFont({
  src: [
    { path: "../../public/fonts/clash-display/ClashDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/clash-display/ClashDisplay-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-clash-display",
  display: "swap",
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prospecteur — Adam Bellanger",
  description: "Outil interne de prospection",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Rendu à chaque requête : le nonce CSP (src/proxy.ts) doit être neuf.
  await connection();
  return (
    <html lang="fr" className={`${clashDisplay.variable} ${inter.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen">
        <Providers>
          <CursorFollower />
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  );
}
