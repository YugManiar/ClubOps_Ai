import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { getCurrentMember } from "@/lib/data";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "ClubOps AI",
  description: "Agentic event management for college clubs",
};

/**
 * Runs before first paint so a saved (or system) dark preference never flashes
 * white. Must stay in sync with ThemeToggle: same "theme" key, same `dark` class.
 */
const THEME_INIT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember(); // null on /login, /signup (no session)

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen">
        {member && <SiteHeader member={member} />}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </body>
    </html>
  );
}
