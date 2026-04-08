import { redirectIfAuthenticated } from "../lib/auth";
import AuthForm from "./auth-form";

const Homepage = async () => {
  await redirectIfAuthenticated();

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-medium">Marble</h1>
        <p className="text-sm text-stone-400">
          Sign in with Supabase to access the demo workspace.
        </p>
        <AuthForm />
      </div>
    </main>
  );
};

export default Homepage;
