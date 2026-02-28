import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenStudio | Post-Production App",
  description: "AI-powered post-production application for synthetic media generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} antialiased bg-black text-white selection:bg-indigo-500/30 min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
