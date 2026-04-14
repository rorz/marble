import { redirectIfAuthenticated } from "../lib/auth";
import AuthForm from "./auth-form";

const Homepage = async () => {
  await redirectIfAuthenticated();

  return (
    <main className="min-h-screen p-6 bg-taupe-300">
      <div className="max-w-xl flex flex-col gap-8 h-full">
        <h1 className="font-light text-9xl">Marble</h1>
        <div className="flex flex-col gap-4 mb-auto text-4xl text-neutral-500">
          <p>
            Where the world&apos;s best GTM engineers build their workflows.
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
};

export default Homepage;
