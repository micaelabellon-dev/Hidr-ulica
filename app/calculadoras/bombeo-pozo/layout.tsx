import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bombeo desde pozo",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
