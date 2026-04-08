import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const Homepage = async () => {
  const { userId } = await auth();

  if (userId) {
    redirect("/demo");
  }

  const signInButton = (
    <button
      type="button"
      className="rounded border border-stone-600 px-3 py-2 text-sm text-stone-100 hover:bg-stone-900"
    >
      Sign in
    </button>
  );

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-medium">Marble</h1>
        <SignInButton mode="modal">sign in</SignInButton>
      </div>
    </main>
  );
};

export default Homepage;
