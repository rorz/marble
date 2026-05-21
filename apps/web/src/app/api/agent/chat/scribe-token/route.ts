import "server-only";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth";

const ELEVENLABS_TOKEN_URL =
  "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";

const TOKEN_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

type ElevenLabsTokenResponse = {
  token?: unknown;
};

export const POST = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  let response: Response;
  try {
    response = await fetch(ELEVENLABS_TOKEN_URL, {
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
      },
      method: "POST",
    });
  } catch (cause) {
    console.error(
      "[/api/agent/chat/scribe-token] upstream fetch failed",
      cause,
    );
    return new Response("ElevenLabs token request failed before a response.", {
      status: 502,
    });
  }

  if (!response.ok) {
    const body = await response.text();
    console.error("[/api/agent/chat/scribe-token] upstream rejected request", {
      body: body.slice(0, 500),
      status: response.status,
    });
    return new Response(
      `ElevenLabs token request failed (${response.status}).`,
      {
        status: 502,
      },
    );
  }

  let data: ElevenLabsTokenResponse;
  try {
    data = (await response.json()) as ElevenLabsTokenResponse;
  } catch (cause) {
    console.error(
      "[/api/agent/chat/scribe-token] invalid upstream JSON",
      cause,
    );
    return new Response("ElevenLabs token response was invalid JSON.", {
      status: 502,
    });
  }

  if (typeof data.token !== "string" || data.token.length === 0) {
    console.error("[/api/agent/chat/scribe-token] missing token field");
    return new Response("ElevenLabs token response was invalid.", {
      status: 502,
    });
  }

  return Response.json(
    {
      token: data.token,
    },
    {
      headers: TOKEN_RESPONSE_HEADERS,
    },
  );
};
