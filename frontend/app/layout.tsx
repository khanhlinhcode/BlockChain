import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CertChain | Blockchain Certificate Verification",
    template: "%s | CertChain",
  },
  description:
    "Enterprise-grade certificate issuance and blockchain verification built for trust, permanence, and speed.",
  openGraph: {
    title: "CertChain | Blockchain Certificate Verification",
    description:
      "Enterprise-grade certificate issuance and blockchain verification built for trust, permanence, and speed.",
    type: "website",
    siteName: "CertChain",
  },
  twitter: {
    card: "summary_large_image",
    title: "CertChain | Blockchain Certificate Verification",
    description:
      "Enterprise-grade certificate issuance and blockchain verification built for trust, permanence, and speed.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${jakarta.variable} ${mono.variable}`}
    >
      <body>
        <Providers>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
