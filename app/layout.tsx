import type { Metadata, Viewport } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";
import Providers from "./providers";
import ServiceWorker from "./ServiceWorker";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const display = Nunito({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap", weight: ["600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Lumi – oppimiskaveri",
  description: "Tavallinen tekoäly antaa vastauksia. Lumi auttaa lapsia löytämään ne itse.",
  applicationName: "Lumi",
  appleWebApp: { capable: true, title: "Lumi", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={`${sans.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
