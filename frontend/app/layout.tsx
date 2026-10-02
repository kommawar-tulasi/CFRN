import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { SimulationCompletedDialog } from "@/components/simulation-completed-dialog";
import { SimulationProvider } from "@/components/simulation-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CFRN | Congestion-Free Router Networking",
  description: "Network routing and congestion simulation console.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SimulationProvider>
          <AppShell>{children}</AppShell>
          <SimulationCompletedDialog />
        </SimulationProvider>
      </body>
    </html>
  );
}
