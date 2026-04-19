import { Section, SectionHeader } from "../ui/section";

export function GiantsSection() {
  return (
    <Section tone="mid">
      <SectionHeader
        eyebrow="On the shoulders of giants"
        heading="Supabase for realtime. Cloudflare for orchestration."
        lede="Realtime interaction via Supabase. Powerful orchestration and distributed execution via Cloudflare."
      />
    </Section>
  );
}
