import { HarpClient } from "@harp/sdk";
import dotenv from "dotenv";
import { readCliEnv } from "./env";

dotenv.config();

let harp: HarpClient | undefined;

export const getHarpClient = () => {
  harp ??= new HarpClient({
    baseUrl: readCliEnv(process.env).HARP_API_URL,
  });
  return harp;
};
