import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mezcla rápida",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
