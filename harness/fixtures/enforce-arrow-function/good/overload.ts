function overload(x: string): string;
function overload(x: number): number;
function overload(x: string | number): string | number {
  return x;
}
