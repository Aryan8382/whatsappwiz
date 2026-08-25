import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whatsapp Wiz",
  description: "Multi-tenant WhatsApp Business API platform",
  icons: {
    icon: "/whatsapp-wiz-favicon.png",
    shortcut: "/whatsapp-wiz-favicon.png",
    apple: "/whatsapp-wiz-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
