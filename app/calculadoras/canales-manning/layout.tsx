import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Canales con Manning",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
