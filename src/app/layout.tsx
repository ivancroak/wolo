import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wolo - On-Chain Social Marketplace",
  description: "The trustless marketplace for social influence on Solana",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (!localStorage.getItem("theme")) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
              } else if (localStorage.getItem("theme") === "dark") {
                document.documentElement.classList.add("dark");
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
