import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Humedal de flujo vertical",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
