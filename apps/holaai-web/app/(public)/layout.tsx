import { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen w-full flex-col">{children}</div>;
}
