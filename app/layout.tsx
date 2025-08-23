import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from '@vercel/analytics/react';
import ClientThemeProvider from "../components/ClientThemeProvider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Polmatch - Messenger",
  description: "A simple communication platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Initialize theme ASAP to prevent white flash */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const t = localStorage.getItem('theme'); const theme = (t === 'light' || t === 'dark') ? t : 'dark'; const e = document.documentElement; e.classList.remove('light','dark'); e.classList.add(theme); } catch(_) { document.documentElement.classList.add('dark'); } })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: '#000', color: '#fff' }}
        suppressHydrationWarning={true}
      >
        <ClientThemeProvider>
          {children}
        </ClientThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
