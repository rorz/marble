import { requireUser } from "../../lib/auth";

export default async function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return children;
}
