import Image from "next/image";
import AuthForm from "../auth-form";
import { Section } from "../ui/section";

export function HeroSection() {
  return (
    <Section
      className="flex flex-col gap-8 items-start justify-end min-h-[80vh] pb-0 overflow-hidden"
      tone="light"
    >
      <div className="relative">
        <div className="absolute -left-[220px] -top-[200px] rotate-12  size-[500px] object-cover">
          <Image
            alt="dude"
            className="size-full object-contain"
            height={700}
            src="/example_dude_5.png"
            width={500}
          />
          {/* <div className="top-0 left-0 size-full absolute bg-radial-[at_25%_25%] from-taupe-200/0 to-taupe-200 to-75%" /> */}
        </div>

        <div className="absolute -top-[140px] left-[140px] rounded-full bg-taupe-500 px-11 py-6 z-30">
          <div className="absolute left-4 size-22 bottom-0 -rotate-12 bg-taupe-500 rounded-sm" />
          <h3 className="relative text-6xl text-taupe-200/90 italic font-regular">
            Finally...!
          </h3>
        </div>
      </div>
      <div className="border-l-8 border-b-5 border-orange-500 pl-6 ml-64 bg-taupe-100 py-4 border-2 rounded-xs">
        <p className="text-taupe-800 text-5xl max-w-3xl leading-snug">
          <span className="text-orange-400 font-medium">Fast,</span> reliable,
          and open GTM tooling built by{" "}
          <span className="inline-block px-2 py-1 bg-taupe-100/10 rounded-lg -rotate-3 border-dotted border-4 border-taupe-400/10 text-taupe-500 hover:rotate-0 transition-transform">
            and for!
          </span>{" "}
          <strong className="underline decoration-orange-300">the best</strong>{" "}
          operators and engineers.
        </p>
      </div>
      <Wordmark />
    </Section>
  );
}

function Wordmark() {
  return (
    <div className="-left-6 -bottom-6 relative inline-block font-display font-medium text-[20rem] leading-none tracking-tight">
      <h1 className="absolute -left-4 text-orange-500/20">Marble</h1>
      <h1 className="absolute -left-2 text-orange-500/70">Marble</h1>
      <h1 className="relative text-orange-600">Marble</h1>
    </div>
  );
}
