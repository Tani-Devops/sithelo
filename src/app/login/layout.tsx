import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Sithelo",
  description: "Log in to your Sithelo account.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
