type OilPppIranDescriptionProps = {
  locale?: "en" | "fa";
};

export function OilPppIranDescription({ locale = "en" }: OilPppIranDescriptionProps) {
  const isFa = locale === "fa";
  return (
    <p className="mt-3 max-w-full text-sm text-muted-foreground break-words">
      {isFa
        ? "برابری قدرت خرید (PPP) تفاوت سطح قیمت بین کشورها را در نظر می‌گیرد و ارزش را بر پایهٔ توان خرید داخلی، نه نرخ بازار، بیان می‌کند. این سری یک نمایندهٔ بار اقتصادی است—برآیندی از «سنگینی» قیمت نفت در ایران—و قیمت بازار نیست. داده‌ها فقط سالانه‌اند."
        : "Purchasing power parity (PPP) adjusts for differences in price levels across countries, expressing values in terms of domestic purchasing power rather than market exchange rates. This series is a burden proxy—it estimates the domestic economic weight of oil prices in Iran—and is not a market price. Data are annual only."}
    </p>
  );
}
