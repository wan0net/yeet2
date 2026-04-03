import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TopBar } from "@yeet2/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "yeet2",
  description: "Autonomous software-team control plane"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html data-theme="light" lang="en">
      <body className="yeet-shell-grid">
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <TopBar />
          <div className="mt-5">{children}</div>
        </div>
      </body>
    </html>
  );
}
