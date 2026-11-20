import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notiq — Hızlı Akıllı Notlar",
  description:
    "Üstten hızlı yazma, akıllı sık-kullanılan sıralaması, anlık arama ve yarı saydam geçişlerle en verimli not deneyimi.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F4F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0D11" },
  ],
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('notiq.theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = saved ? saved === 'dark' : true;
    if (saved === 'system') isDark = prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="ambient-canvas min-h-screen antialiased selection:bg-blue-500/25">
        {children}
      </body>
    </html>
  );
}
