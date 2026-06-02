export type CliEnv = {
  HARP_API_URL: string;
};

export const readCliEnv = (
  env: Record<string, string | undefined>,
): CliEnv => ({
  HARP_API_URL: env.HARP_API_URL ?? "http://localhost:4277",
});
