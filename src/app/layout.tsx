import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { CreditHydrator } from "@/components/providers/credit-hydrator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bookclad.com"),
  title: {
    default: "BookClad - AI Book Cover Generator",
    template: "%s | BookClad",
  },
  description:
    "Generate KDP-compliant Kindle ebook covers from natural language prompts. Genre-aware AI, typography, compliance checker — all in one flow.",
  keywords: [
    "AI book cover generator",
    "KDP cover maker",
    "Kindle cover design",
    "ebook cover creator",
    "Amazon KDP cover",
    "book cover design tool",
    "self-publishing cover generator",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bookclad.com",
    siteName: "BookClad",
    title: "BookClad - AI Book Cover Generator",
    description:
      "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BookClad - AI Book Cover Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BookClad - AI Book Cover Generator",
    description:
      "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://bookclad.com",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  let creditBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditBalance: true },
    });
    creditBalance = user?.creditBalance ?? 0;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {session?.user && <CreditHydrator balance={creditBalance} />}
          <NavbarWrapper><Navbar /></NavbarWrapper>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
