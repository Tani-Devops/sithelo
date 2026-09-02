import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | Sithelo",
  description: "Create your Sithelo account as an entrepreneur or an institution.",
  // Canonicalizes to the bare path — /register?role=entrepreneur and
  // /register?role=institution are the same indexable page with a UI
  // preselection, not distinct content.
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
