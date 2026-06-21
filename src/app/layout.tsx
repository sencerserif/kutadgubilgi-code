import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kutadgubilgi Code - Çoklu AI Sağlayıcı Kod Asistanı",
  description:
    "Kutadgubilgi Code - 7+ AI sağlayıcıyı (OpenAI, Anthropic, Google, DeepSeek, xAI, Ollama, OpenRouter) tek arayüzde toplayan akıllı kod asistanı. Streaming, MCP, vector embeddings ve daha fazlası.",
  keywords: [
    "Kutadgubilgi Code",
    "AI Code",
    "Claude Code",
    "Multi-provider AI",
    "OpenAI",
    "Anthropic",
    "Gemini",
    "DeepSeek",
    "Code Assistant",
    "MCP",
    "Vector Embeddings",
  ],
  authors: [{ name: "Kutadgubilgi Code" }],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
