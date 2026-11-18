import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cumplimiento de calidad de aire",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
