import { MarbleClient } from "@marble/sdk";
import dotenv from "dotenv";
import { readCliEnv } from "./env";

dotenv.config();

let marble: MarbleClient | undefined;

export const getMarbleClient = () => {
  marble ??= (() => {
    const env = readCliEnv(process.env);

    return new MarbleClient({
      driver: {
        actorSource: "CLI",
        apiKey: env.MARBLE_API_KEY,
        apiUrl: env.MARBLE_API_URL,
        type: "api",
      },
    });
  })();

  return marble;
};
