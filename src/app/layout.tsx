'use client';

import { useState } from "react";
import "./globals.css";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <html lang="en">
      <body className="bg-[#f3f4f6] text-gray-900 font-sans min-h-screen">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

          {/* Main Workspace */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Functional Header Bar */}
            <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

            {/* Content Scroll View */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-4">
              <div className="max-w-[1600px] mx-auto space-y-6">
                {children}
              </div>
            </main>
          </div>
        </div>

        <Toaster
          theme="light"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#111827',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
