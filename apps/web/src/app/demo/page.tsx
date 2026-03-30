const DemoPage = () => {
  return (
    <div className="bg-neutral-100 flex flex-col gap-8 p-4 min-h-screen">
      <h1 className="text-4xl font-bold">Marble</h1>
      <div className="p-16 bg-neutral-200 flex gap-2">
        <button type="button" className="bg-neutral-950 p-0.5 w-28">
          <div
            className="size-full p-[1px] rounded-md"
            style={{
              background: `
              linear-gradient(to right, var(--color-neutral-300) 0px, #40404000 4px),
              linear-gradient(to left, var(--color-neutral-800) 0px, #40404000 4px),
              linear-gradient(to top, var(--color-neutral-950) 0px, #40404000 4px),
              linear-gradient(to bottom, var(--color-neutral-100) 0px, #40404000 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #40404000 4px)
              `,
            }}
          >
            <div className="size-full text-neutral-100 bg-neutral-700 flex items-center justify-center font-light uppercase py-1.5 px-3 rounded-[5px] tracking-wide text-sm">
              Download
            </div>
          </div>
        </button>
        <button type="button" className="bg-neutral-950 p-0.5 w-28">
          <div
            className="size-full p-[1px] rounded-md bg-orange-600"
            style={{
              background: `linear-gradient(to right, var(--color-orange-300) 0px, #F6490000 4px),
              linear-gradient(to left, var(--color-orange-800) 0px, #F6490000 4px),
              linear-gradient(to top, var(--color-orange-950) 0px, #F6490000 4px),
              linear-gradient(to bottom, var(--color-orange-300) 0px, #F6490000 4px),
              linear-gradient(to bottom right, var(--color-white) 0px, #F6490000 4px), linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)
              `,
            }}
          >
            <div className="size-full text-neutral-100 bg-orange-600 flex items-center justify-center font-light uppercase py-1.5 px-3 rounded-[5px] tracking-wide text-sm">
              Run Col
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default DemoPage;
