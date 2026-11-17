import type { Metadata } from "next";
import { CartProvider } from "@/lib/cart";
import {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  TAGLINE,
} from "@/lib/seo";
import "./globals.css";

const TITLE = `${SITE_NAME} | حوله و زیرانداز ساحلی از الیاف طبیعی`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Note: no `alternates.canonical` and no `openGraph.url` here - a layout's
  // metadata is inherited, so either one would point every page in the site
  // at the homepage. Pages set their own.
  //
  // The rest is inherited on purpose. Without an og:image a shared link has no
  // picture at all, and the messengers fall back to scraping the header logo
  // and stretching it across the card.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "fa_IR",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/** Tells Google which mark belongs to the site - the favicon alone is a weak
 *  and slowly-recrawled signal. */
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "MOAI Gallery",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/og-default.jpg`,
        width: 1200,
        height: 630,
      },
      image: `${SITE_URL}/images/og-default.jpg`,
      slogan: TAGLINE,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "fa-IR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <head>
        {/* main fonts preloaded - self-hosted, no external requests */}
        <link
          rel="preload"
          href="/fonts/Vazirmatn-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/markazi-text-arabic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="grain antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
