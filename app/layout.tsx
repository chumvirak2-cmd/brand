import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B2G INVENTORY — Stock management",
  description: "A clear view of your stock, wherever work takes you.",
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
