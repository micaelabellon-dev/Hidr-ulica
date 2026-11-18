import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Golpe de ariete",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
