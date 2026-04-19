import { Section, SectionHeader } from "../ui/section";

export function PricingSection() {
  return (
    <Section tone="dark">
      <SectionHeader
        eyebrow="No credits"
        heading="Pay for milliseconds, not seats."
        lede="Run as much as you want. The cloud offering runs on compute, so you're only charged for the milliseconds your cells actually run."
      />
    </Section>
  );
}
