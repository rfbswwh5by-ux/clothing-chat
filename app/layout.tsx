import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORME — Your personal AI stylist",
  description: "A personal AI stylist that understands your closet, the weather, and your plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
