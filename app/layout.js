import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata = {
  metadataBase: new URL("https://onewordtoday.live"),
  title: "One Word Today",
  description:
    "How was your day, in one word? A live, glowing map of the world — one word, one point, one moment at a time.",
  openGraph: {
    title: "One Word Today",
    description: "How was your day, in one word?",
    type: "website",
    url: "https://onewordtoday.live",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080B10",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
    <meta name="google-adsense-account" content="ca-pub-2235714345131263">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Space+Grotesk:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
