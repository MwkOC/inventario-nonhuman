import "../src/style.css";

export const metadata = {
  title: "NonHuman | Laboratorio",
  description: "NonHuman: gestion del laboratorio",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "NonHuman" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17231e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
