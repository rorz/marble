"use client";

import { MarbleButton } from "@marble/ui";
import { ArrowUpRightIcon, GithubLogoIcon } from "@phosphor-icons/react/ssr";
import { MarketingStackedWordmark } from "../ui/mark";
import {
  MarketingMarquee,
  MarketingSplash,
  MarketingSplashContent,
  MarketingSplashSpec,
} from "../ui/splash";
import { MarketingTiltCard } from "../ui/tilt-card";

/**
 * "Closing" full-bleed splash — big stacked wordmark + a CTA cluster
 * over a faded dude image. Acts as the visual button before the
 * footer's link grid.
 */
export function WordmarkSplashSection() {
  return (
    <div className="bg-taupe-900">
      <MarketingSplash
        height="full"
        imageAlt=""
        imageFloat
        imagePosition="bottom"
        imageScale={1.05}
        imageSrc="/example_dude_2.png"
        tone="darkest"
        veil="vignette"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 marketing-grid-bg"
        />

        <MarketingSplashContent
          align="center"
          className="relative gap-10"
        >
          <MarketingSplashSpec className="text-orange-300">
            START · INSTALL · OPERATE
          </MarketingSplashSpec>

          <MarketingTiltCard
            className="pointer-events-none"
            float
            glare={false}
            maxTilt={5}
          >
            <MarketingStackedWordmark
              size="xl"
              tone="orange"
            >
              Marble
            </MarketingStackedWordmark>
          </MarketingTiltCard>

          <p className="max-w-2xl text-balance font-display text-2xl text-taupe-100/90 leading-snug md:text-4xl">
            A spreadsheet that runs code, built for the agents that operate on
            your behalf.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <MarbleButton
              iconRight={ArrowUpRightIcon}
              variant="orange"
            >
              Start a workspace
            </MarbleButton>
            <MarbleButton
              iconLeft={GithubLogoIcon}
              variant="dark"
            >
              github.com/marble
            </MarbleButton>
          </div>
        </MarketingSplashContent>
      </MarketingSplash>

      <MarketingMarquee
        direction="left"
        phrase="OPEN SOURCE · AGENT NATIVE · OPERATOR FIRST"
        separator="✦"
        speed="slow"
        tone="orange"
      />
    </div>
  );
}
