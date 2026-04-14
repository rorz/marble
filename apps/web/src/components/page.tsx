import type { FunctionComponent } from "react";

type PageProps = {
  title: string;
  subtitle: string;
  showBackButton?: boolean;
  width: "Full" | "Wide" | "Standard" | "Narrow";
};

export const Page: FunctionComponent<PageProps> = () => {
  return null;
};
