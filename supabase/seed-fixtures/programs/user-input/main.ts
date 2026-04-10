export default ({ input, cell }) => {
  const raw = cell.manualInputValue;

  switch (input.format) {
    case "number":
      return Number(raw);
    case "boolean":
      return raw?.toLowerCase() === "true";
    default:
      return raw;
  }
};
