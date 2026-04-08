import { requireUser } from "../../lib/auth";

export default async function TestProgramsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return children;
}
