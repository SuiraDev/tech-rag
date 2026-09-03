import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech RAG",
  description: "Assistente para documentos de estudo em tecnologia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
