import { redirectIfAuthenticated } from "../lib/auth";
import AuthForm from "./auth-form";

const Homepage = async () => {
  await redirectIfAuthenticated();

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-medium">Marble</h1>
        <AuthForm />
      </div>
    </main>
  );
};

export default Homepage;
