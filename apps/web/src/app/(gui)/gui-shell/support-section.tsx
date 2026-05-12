import type { ReactNode } from "react";

export function SupportPanelSection({
  children,
  title,
}: Readonly<{
  children: ReactNode;
  title: string;
}>) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium text-sm text-taupe-900">{title}</h3>
      <div className="space-y-2 text-sm text-taupe-700">{children}</div>
    </section>
  );
}
