export default ({ input }) => {
  const raw = input.formula;

  if (typeof raw !== "string") {
    return raw;
  }

  // Attempt to evaluate it as a JavaScript expression.
  // If the user types a literal string like `Hello {{name}}`,
  // it will throw a SyntaxError and we'll fallback to returning it directly.
  // If they type `1 + 1` or `["a", "b"].join(",")`, it evaluates to the result.
  try {
    const fn = new Function(`return (${raw});`);
    return fn();
  } catch {
    return raw;
  }
};
