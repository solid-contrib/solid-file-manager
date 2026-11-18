import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import LdoProvider from "./components/providers/LdoProvider";
import SolidFetchProvider from "./components/providers/SolidFetchProvider";
import ThemeProvider from "./components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

// Fonts are bundled from npm packages rather than fetched from Google Fonts
// at build time, so builds don't depend on that service being reachable.
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans",
});

const geistSans = GeistSans;
const geistMono = GeistMono;

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LdoProvider>
            <SolidFetchProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </SolidFetchProvider>
          </LdoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
