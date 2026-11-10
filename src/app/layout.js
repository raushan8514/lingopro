import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";
import "./design-system.css";
import "./auth.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "LingoPro — A wider world starts with a word",
    template: "%s · LingoPro",
  },
  description:
    "A thoughtful home for curious minds and meaningful language-learning progress.",
  openGraph: {
    title: "LingoPro — A wider world starts with a word",
    description:
      "Explore a thoughtful concept for learning languages through context, practice, and meaningful progress.",
    siteName: "LingoPro",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LingoPro — A wider world starts with a word",
    description:
      "Explore a thoughtful concept for learning languages through context, practice, and meaningful progress.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="lingopro-theme-init" strategy="beforeInteractive">
          {`(()=>{try{const t=localStorage.getItem("lingopro-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}else{document.documentElement.removeAttribute("data-theme");document.documentElement.style.removeProperty("color-scheme")}}catch(e){console.error("LingoPro theme initialization failed; using system theme.",e);document.documentElement.removeAttribute("data-theme");document.documentElement.style.removeProperty("color-scheme")}})()`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
