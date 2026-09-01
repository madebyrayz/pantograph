import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

export const metadata: Metadata = {
  title: "Pantograph",
  description: "Intelligence Aided Design — an AI workspace for Rhino",
  icons: {
    icon: [
      { url: "/brand/mark-black-32.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/mark-white-32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/brand/mark-black-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/mark-black-180.png", sizes: "180x180" }],
  },
}

import "./globals.css"
import "@xyflow/react/dist/style.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable, "font-sans")}
    >
      <body>
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
