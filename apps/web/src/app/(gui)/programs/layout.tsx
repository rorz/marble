import { requireUser } from "../../../lib/auth";

const TestProgramsLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  await requireUser();
  return children;
};
export default TestProgramsLayout;
