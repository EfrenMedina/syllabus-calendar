import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { CalendarDays } from "lucide-react";
import { SyllabusProvider } from "@/context/SyllabusProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Syllabus Calendar",
  description: "Turn a course syllabus PDF into a calendar file you can import anywhere.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SyllabusProvider>
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <CalendarDays className="size-5 text-blue-600 dark:text-blue-400" aria-hidden />
                Syllabus Calendar
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
          <Toaster position="bottom-center" />
        </SyllabusProvider>
      </body>
    </html>
  );
}
