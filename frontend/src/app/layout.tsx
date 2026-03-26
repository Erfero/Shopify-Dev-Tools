import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "Shopify Dev Tools",
  description: "Loox Review Generator & Shopify Theme Customizer",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
