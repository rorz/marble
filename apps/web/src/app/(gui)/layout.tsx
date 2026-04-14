import { requireUser } from "../../lib/auth";

export default async function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[250px_1fr] grid-rows-1 bg-taupe-200">
      {/* <header className="md:col-span-2 w-full p-2 bg-taupe-50">NAV_BAR</header> */}
      <aside className="bg-taupe-200 p-2">
        <h2>ACCOUNT</h2>
        <ul>
          <li>Projects</li>
          <li>Sources</li>
          <li>Automations</li>
          <li>Programs</li>
          <li>Profiles</li>
          <li>Secrets</li>
        </ul>
      </aside>
      <main className="p-2 bg-transparent pb-8">
        <div className="bg-taupe-50 size-full rounded-sm">{children}</div>
      </main>
    </div>
  );
}
