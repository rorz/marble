import { useCallback, useState } from "react";

export const useProgramLog = () => {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog((current) =>
      [
        `[${timestamp}] ${message}`,
        ...current,
      ].slice(0, 50),
    );
  }, []);

  return {
    addLog,
    log,
    setLog,
  };
};
