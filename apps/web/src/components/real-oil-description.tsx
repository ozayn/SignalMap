export function RealOilDescription() {
  return (
    <p className="mt-3 max-w-full text-sm text-muted-foreground break-words">
      Real oil price denotes inflation-adjusted oil expressed in constant dollars—typically a fixed
      base year. It is used to assess long-term economic burden and to compare prices across decades
      without the distortion of nominal currency fluctuations. Unlike nominal prices, which reflect
      market signals in current dollars, real prices isolate changes in purchasing power. Prices are
      expressed in constant 2015 US dollars using the US CPI.{" "}
      <a
        href="https://en.wikipedia.org/wiki/Real_price"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground underline underline-offset-2"
      >
        Real price (Wikipedia)
      </a>
    </p>
  );
}
