import type { Metadata } from "next";
import { Bricolage_Grotesque, Karla } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { ProgressProvider } from "@/components/progress-provider";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Karla({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Creo-Lingo — Learn African & Caribbean dialects",
  description:
    "Duolingo-style lessons in Haitian Creole, Jamaican Patois, Nigerian Pidgin, and more — built for the African and Caribbean diaspora.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProgressProvider>
          <AppNav />
          <main className="flex-1">{children}</main>
        </ProgressProvider>
      </body>
    </html>
  );
}
