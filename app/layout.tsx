import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Lost and Found",
  description: "A moderated lost and found feed for students."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
