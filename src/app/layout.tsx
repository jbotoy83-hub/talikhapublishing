import type { Metadata, Viewport } from "next";
import { Inter, Literata } from "next/font/google";
import { assertLaunchConfiguration, isIndexingEnabled } from "@/lib/launch";
import {
  getSiteUrl,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TAGLINE
} from "@/lib/site";
import "../styles.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});
const literata = Literata({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-literata",
  display: "swap"
});

export const viewport: Viewport = { themeColor: "#123125", colorScheme: "light" };

const indexingEnabled = isIndexingEnabled();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Publishing",
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: `${SITE_NAME} publications` }] }
  },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} publishing` }]
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: [SITE_OG_IMAGE] },
  robots: {
    index: indexingEnabled,
    follow: indexingEnabled,
    noarchive: !indexingEnabled,
    googleBot: indexingEnabled
      ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
      : { index: false, follow: false, noarchive: true }
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {})
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  assertLaunchConfiguration();
  return (
    <html lang={SITE_LANGUAGE} className={`${inter.variable} ${literata.variable}`}>
      <body className="bg-parchment font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
