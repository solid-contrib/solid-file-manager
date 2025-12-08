import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Toaster from "./components/shared/Toaster";
import LdoProvider from "./components/providers/LdoProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solid File Manager",
  description: "A Google Drive-like file manager for Solid Pods",
    icons: {
      icon: "/file-manager-logo.svg",
      shortcut: "/file-manager-logo.svg",
      apple: "/file-manager-logo.svg",
    },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LdoProvider>
          {children}
          <Toaster />
        </LdoProvider>
      </body>
    </html>
  );
}
