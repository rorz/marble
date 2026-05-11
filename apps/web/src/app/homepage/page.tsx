import { getMarketingMetrics, getMarketingSkyline } from "./actions";
import { AgentFirstSection } from "./sections/agent-first";
import { ByokSection } from "./sections/byok";
import { FooterSection } from "./sections/footer";
import { GiantsSection } from "./sections/giants";
import { HeroSection } from "./sections/hero";
import { InstrumentSplashSection } from "./sections/instrument-splash";
import { MarqueeRoutineSection } from "./sections/marquee-routine";
import { MsBurnedSplashSection } from "./sections/ms-burned-splash";
import { OpenSourceSection } from "./sections/open-source";
import { PricingSection } from "./sections/pricing";
import { ProgramModelSection } from "./sections/program-model";
import { SkylineSplashSection } from "./sections/skyline-splash";
import { WordmarkSplashSection } from "./sections/wordmark-splash";
import { TopBar } from "./ui/top-bar";

// Refresh platform metrics on the homepage every minute. Keeps the
// page statically-rendered (ISR) while the headline counters stay
// approximately current.
export const revalidate = 60;

const Homepage = async () => {
  const metrics = await getMarketingMetrics();
  const skyline = await getMarketingSkyline(metrics);

  return (
    <main className="bg-taupe-300">
      <TopBar />
      <HeroSection />
      <OpenSourceSection />
      <MarqueeRoutineSection />
      <AgentFirstSection />
      <InstrumentSplashSection totalCells={metrics.cells} />
      <ProgramModelSection />
      <SkylineSplashSection
        buildings={skyline}
        totalCells={metrics.cells}
        totalPrograms={metrics.programs}
      />
      <ByokSection />
      <MsBurnedSplashSection
        totalAgents={metrics.agents}
        totalCells={metrics.cells}
        totalRuns={metrics.runs}
      />
      <PricingSection />
      <GiantsSection />
      <WordmarkSplashSection />
      <FooterSection />
    </main>
  );
};

export default Homepage;
