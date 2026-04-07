import app from "@marble/api";

export const GET = (req: Request) => {
  return app.fetch(req, {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL:
      process.env.MARBLE_EXECUTOR_URL || "http://localhost:8787",
  });
};

export const POST = (req: Request) => {
  return app.fetch(req, {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL:
      process.env.MARBLE_EXECUTOR_URL || "http://localhost:8787",
  });
};

export const PUT = (req: Request) => {
  return app.fetch(req, {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL:
      process.env.MARBLE_EXECUTOR_URL || "http://localhost:8787",
  });
};

export const DELETE = (req: Request) => {
  return app.fetch(req, {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    MARBLE_EXECUTOR_URL:
      process.env.MARBLE_EXECUTOR_URL || "http://localhost:8787",
  });
};
