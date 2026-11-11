import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Freelancer Stability Network",
  description: "Find meaningful freelance work. Build lasting stability.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
