import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/nav/TopNav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AlgebraDojo",
  description: "Learn algebra by solving equations hands-on",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <div className="mx-auto min-h-screen w-full max-w-app px-4 pb-safe">
          <TopNav email={user?.email ?? undefined} />
          {children}
        </div>
      </body>
    </html>
  );
}
