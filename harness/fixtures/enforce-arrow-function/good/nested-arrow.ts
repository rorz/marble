const outer = () => {
  const inner = () => 1;
  return inner;
};
