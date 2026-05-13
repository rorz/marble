class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    // Add stack info to error.
    // Inspired by: https://blog.dennisokeeffe.com/blog/2020-08-07-error-tracing-with-sentry-and-es6-classes
    if (Error.captureStackTrace) Error.captureStackTrace(this, AssertionError);
    else this.stack = new Error(message).stack;

    this.name = "AssertionError";
  }
}

// harness-ignore: enforce-arrow-function -- TS assertion functions (`asserts`) require declaration form so call-site narrowing propagates across modules (TS2775).
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}
