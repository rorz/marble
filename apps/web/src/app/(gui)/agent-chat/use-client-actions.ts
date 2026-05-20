"use client";

import { useMarbleRouter } from "@marble/ui";
import { useEffect, useState } from "react";
import type { ClientAction, StreamEvent } from "./types";

export const useClientActions = () => {
  const [clientAction, setClientAction] = useState<ClientAction | null>(null);
  const router = useMarbleRouter();

  useEffect(() => {
    if (!clientAction) return;
    const navigate = clientAction.replace ? router.replace : router.push;
    navigate(clientAction.href);
    setClientAction(null);
  }, [
    clientAction,
    router,
  ]);

  return (event: StreamEvent) => {
    const action = event.clientAction;
    if (action?.type === "browser_navigate") {
      setClientAction(action);
    }
  };
};
