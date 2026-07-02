import type { Metadata } from "next";
import "./globals.css";
import { ProgressProvider } from "@/lib/progress";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Agent Engineering Academy",
  description:
    "26 weeks to senior AI agent engineer — lessons, animations, quizzes, and hands-on labs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ProgressProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 lg:pl-72">
              <div className="mx-auto max-w-4xl px-5 py-10 lg:px-10">
                {children}
              </div>
            </main>
          </div>
        </ProgressProvider>
      </body>
    </html>
  );
}
