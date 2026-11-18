import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Floculación",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
