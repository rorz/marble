import { AnimatePresence, motion } from "motion/react";

const DOTS = [
  0,
  1,
  2,
] as const;

type CueTranscriptionIndicatorProps = {
  active: boolean;
  shouldReduceMotion: boolean | null;
};

export const CueTranscriptionIndicator = ({
  active,
  shouldReduceMotion,
}: CueTranscriptionIndicatorProps) => (
  <AnimatePresence>
    {active ? (
      <motion.div
        animate={{
          opacity: 1,
          x: 0,
        }}
        aria-hidden
        className="-top-6 left-2 absolute flex h-4 items-center gap-1 sm:-left-10 sm:top-1/2 sm:-translate-y-1/2"
        exit={{
          opacity: 0,
          x: -4,
        }}
        initial={{
          opacity: 0,
          x: -4,
        }}
      >
        {DOTS.map((dot) => (
          <motion.span
            animate={
              shouldReduceMotion
                ? {
                    opacity: 1,
                  }
                : {
                    opacity: [
                      0.35,
                      1,
                      0.35,
                    ],
                    y: [
                      0,
                      -4,
                      0,
                    ],
                  }
            }
            className="size-1.5 rounded-full bg-orange-500 shadow-sm shadow-orange-900/10"
            key={dot}
            transition={
              shouldReduceMotion
                ? {
                    duration: 0,
                  }
                : {
                    delay: dot * 0.12,
                    duration: 0.7,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }
            }
          />
        ))}
      </motion.div>
    ) : null}
  </AnimatePresence>
);
