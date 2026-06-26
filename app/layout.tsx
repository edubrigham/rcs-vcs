import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import { SimulatorProvider } from "@/components/SimulatorProvider";
import TopNav from "@/components/TopNav";
import "./globals.css";

// Variable names must match the @theme mappings in globals.css.
const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const intMono = Geist_Mono({
  variable: "--font-int-mono",
  subsets: ["latin"],
});

const intDisplay = Bricolage_Grotesque({
  variable: "--font-int-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RCS Visual Compatibility Simulator · Naxai Lab",
  description:
    "Simulate how the same RCS rich card renders on iOS vs Android — cropping, truncation and action behavior, scored against Google's RBM UX playbooks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${interSans.variable} ${intMono.variable} ${intDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SimulatorProvider>
          <TopNav />
          {children}
        </SimulatorProvider>
      </body>
    </html>
  );
}
