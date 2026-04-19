import { AgentFirstSection } from "./sections/agent-first";
import { ByokSection } from "./sections/byok";
import { FooterSection } from "./sections/footer";
import { GiantsSection } from "./sections/giants";
import { HeroSection } from "./sections/hero";
import { OpenSourceSection } from "./sections/open-source";
import { PricingSection } from "./sections/pricing";
import { ProgramModelSection } from "./sections/program-model";
import { TopBar } from "./ui/top-bar";

const Homepage = async () => {
  return (
    <main className="bg-taupe-300">
      <TopBar />
      <HeroSection />
      <OpenSourceSection />
      <AgentFirstSection />
      <ProgramModelSection />
      <ByokSection />
      <PricingSection />
      <GiantsSection />
      <FooterSection />
    </main>
  );
};

export default Homepage;
