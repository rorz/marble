import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties } from "react";

export const marbleCardVariants = cva(
  "relative isolate flex flex-col overflow-hidden rounded-xs border",
  {
    defaultVariants: {
      tone: "default",
    },
    variants: {
      tone: {
        default: "border-taupe-200 text-taupe-900",
        orange: "border-orange-200 text-taupe-950",
        subtle: "border-taupe-300 text-taupe-950",
      },
    },
  },
);

type MarbleCardTone = NonNullable<
  VariantProps<typeof marbleCardVariants>["tone"]
>;

export const marbleCardSurfaceStyles: Record<MarbleCardTone, CSSProperties> = {
  default: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "rgb(255 255 255)",
    backgroundImage: [
      "radial-gradient(140% 120% at 0% 0%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0) 52%)",
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(253,253,253,0.97) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
  orange: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "oklch(98% 0.016 73.684)",
    backgroundImage: [
      "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 48%)",
      "linear-gradient(135deg, oklch(95.4% 0.038 75.164 / 20%) 0%, oklch(98% 0.016 73.684) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
  subtle: {
    backgroundBlendMode: "screen, normal",
    backgroundColor: "oklch(96% 0.002 17.2)",
    backgroundImage: [
      "radial-gradient(140% 120% at 0% 0%, oklch(96% 0.002 17.2 / 80%) 0%, rgba(255,255,255,0) 52%)",
      "linear-gradient(180deg, oklch(96% 0.002 17.2) 0%, oklch(98.6% 0.002 67.8) 100%)",
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "100% 100%, 100% 100%",
  },
};

export const marbleCardInteractiveBaseClassName =
  "cursor-pointer transition-[colors,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 active:translate-y-px";

export const marbleCardInteractiveHoverByTone: Record<MarbleCardTone, string> =
  {
    default:
      "hover:border-taupe-300 hover:shadow-sm hover:shadow-zinc-950/[0.04]",
    orange:
      "hover:border-orange-300 hover:shadow-sm hover:shadow-orange-950/[0.06]",
    subtle:
      "hover:border-taupe-400 hover:shadow-sm hover:shadow-zinc-950/[0.04]",
  };

export const marbleCardHeaderVariants = cva("flex flex-col gap-1.5 p-5", {
  defaultVariants: {
    divided: false,
  },
  variants: {
    divided: {
      false: "",
      true: "border-b border-taupe-200",
    },
  },
});

export const marbleCardHeaderTextVariants = cva(
  "flex min-w-0 flex-1 flex-col gap-1.5",
);

export const marbleCardHeaderActionsVariants = cva(
  "flex shrink-0 flex-wrap items-center gap-2 self-start",
);

export const marbleCardContentVariants = cva("flex flex-col px-5 pb-5");

export const marbleCardSectionVariants = cva(
  "border-t border-taupe-200 px-5 py-5 first:border-t-0",
);

export const marbleCardFooterVariants = cva(
  "mt-auto flex items-center justify-end gap-3 border-t border-taupe-200 px-2 py-2 bg-taupe-50",
);

export const marbleCardTitleVariants = cva(
  "font-semibold text-base text-zinc-900",
);

export const marbleCardDescriptionVariants = cva("text-sm text-zinc-600");
