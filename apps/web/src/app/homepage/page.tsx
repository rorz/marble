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
import { WordmarkSplashSection } from "./sections/wordmark-splash";
import { TopBar } from "./ui/top-bar";

const Homepage = async () => {
  return (
    <main className="bg-taupe-300">
      <TopBar />
      <HeroSection />
      <OpenSourceSection />
      <MarqueeRoutineSection />
      <AgentFirstSection />
      <InstrumentSplashSection />
      <ProgramModelSection />
      <ByokSection />
      <MsBurnedSplashSection />
      <PricingSection />
      <GiantsSection />
      <WordmarkSplashSection />
      <FooterSection />
    </main>
  );
};

export default Homepage;
