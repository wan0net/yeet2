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
      <body>
        <div className="mx-auto min-h-screen max-w-[1200px] px-6 py-6 sm:px-8">
          <TopBar />
          <div className="mt-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
