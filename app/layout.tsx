import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VedaAI — Assessment Extraction & Answer Mapping",
  description:
    "Upload a question paper and a handwritten answer sheet to extract, map, highlight, and grade answers with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased text-ink`}>
        {children}
      </body>
    </html>
  );
}
