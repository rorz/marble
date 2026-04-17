import AuthForm from "./auth-form";

const Homepage = async () => {
  return (
    <main className="bg-taupe-300">
      <div className="size-full flex flex-col gap-8 items-start justify-end h-[calc(100vh-_1rem)] p-4 bg-taupe-200 text-taupe-500">
        <div className="p-4 grid grid-cols-2 relative z-20">
          <p className="text-taupe-800 text-4xl max-w-3xl">
            Fast, reliable, and open GTM tooling built by{" "}
            <div className="inline px-2 py-1 bg-taupe-100 rounded-lg transform rotate-12 text-taupe-400">
              and for!
            </div>{" "}
            <strong>the best</strong> operators and engineers.
          </p>
          <AuthForm />
        </div>
        {/* <svg
          aria-hidden="true"
          className="absolute"
          height="0"
          width="0"
        >
          <filter id="stack-outline">
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius="3"
              result="expanded"
            />

            <feComposite
              in="expanded"
              in2="SourceAlpha"
              operator="out"
              result="outline"
            />

            <feFlood
              floodColor="#9a3412"
              result="outlineColor"
            />
            <feComposite
              in="outlineColor"
              in2="outline"
              operator="in"
              result="stroke"
            />

            <feMerge>
              <feMergeNode in="stroke" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg> */}
        <div
          className="relative inline-block mb-12 font-display font-medium text-[20rem]"
          // style={{
          //   filter: "url(#stack-outline)",
          // }}
        >
          <h1 className="absolute left-4 text-orange-500/20">Marble</h1>
          <h1 className="absolute left-2 text-orange-500/70">Marble</h1>
          <h1 className="relative text-orange-600">Marble</h1>
        </div>
        {/* <AuthForm /> */}
      </div>
      <div className="bg-taupe-800 text white p-22 flex flex-col gap-12 items-start">
        <h1 className="text-7xl font-mono">Open source 0123456</h1>
        <h2 className="text-4xl text-taupe-300 font-display">by design</h2>
        <h1>
          Open source. Free to use forever. One click install -- do whatever you
          want with the compromise of no support. Link to PostHog post/model.
        </h1>
      </div>
      <div className="bg-taupe-500 text white p-22">
        <h1 className="text-7xl font-display">Agent first</h1>
        <h1>
          Designed to be Agent-first. It's the future and will work with any
          agent via Skills and Plugins. Single-command set up (with account).
          Provides a "tabular" interface for many kinds of agentic workflows.
        </h1>
      </div>
      <div className="bg-taupe-800 text white p-22">
        <h1>Every column is a program. Every program is shareable.</h1>
      </div>
      <div className="bg-taupe-500 text white p-22">
        <h1>
          Bring your own keys or use our managed ones. Get started without any
          additional setup.
        </h1>
      </div>
      <div className="bg-taupe-700 text white p-22">
        <h1>
          No credits. Run as much as you want -- since the cloud offering runs
          on compute, you're just charged for the milliseconds that your cells
          run.
        </h1>
      </div>
      <div className="bg-taupe-500 text white p-22">
        <h1>
          Built on the shoulders of giants. Realtime interaction with Supabase.
          Powerful orchestration and distributed execution with Cloudflare.
        </h1>
      </div>
    </main>
  );
};

export default Homepage;
