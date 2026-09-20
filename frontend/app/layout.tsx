import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { getCurrentMember } from "@/lib/data";

import "./globals.css";

export const metadata: Metadata = {
  title: "ClubOps AI",
  description: "Agentic event management for college clubs",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember(); // null on /login, /signup (no session)

  return (
    <html lang="en">
      <body className="min-h-screen bg-muted/40">
        {member && <SiteHeader member={member} />}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </body>
    </html>
  );
}
