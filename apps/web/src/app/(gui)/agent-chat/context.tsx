"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { AgentChatPageContext } from "./types";
import { useSession } from "./use-session";

const AgentChatContext = createContext<ReturnType<typeof useSession> | null>(
  null,
);

type AgentChatProviderProps = {
  children: ReactNode;
  pageContext?: AgentChatPageContext;
};

export const AgentChatProvider = ({
  children,
  pageContext,
}: AgentChatProviderProps) => {
  const session = useSession({
    pageContext,
  });

  return (
    <AgentChatContext.Provider value={session}>
      {children}
    </AgentChatContext.Provider>
  );
};

export const useAgentChatSession = () => {
  const session = useContext(AgentChatContext);

  if (!session) {
    throw new Error("Agent chat components must be used inside AgentChat.");
  }

  return session;
};
