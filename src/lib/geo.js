// A small, honest country + currency list. The onboarding prefills these from
// the device, and the user can change them. Kept short on purpose: the ones
// people actually live in, plus a sensible fallback.

export const COUNTRIES = [
  { code: "MA", name: "Morocco", currency: "MAD", calling: "+212" },
  { code: "FR", name: "France", currency: "EUR", calling: "+33" },
  { code: "ES", name: "Spain", currency: "EUR", calling: "+34" },
  { code: "GB", name: "United Kingdom", currency: "GBP", calling: "+44" },
  { code: "DE", name: "Germany", currency: "EUR", calling: "+49" },
  { code: "IT", name: "Italy", currency: "EUR", calling: "+39" },
  { code: "NL", name: "Netherlands", currency: "EUR", calling: "+31" },
  { code: "BE", name: "Belgium", currency: "EUR", calling: "+32" },
  { code: "PT", name: "Portugal", currency: "EUR", calling: "+351" },
  { code: "US", name: "United States", currency: "USD", calling: "+1" },
  { code: "CA", name: "Canada", currency: "CAD", calling: "+1" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", calling: "+971" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", calling: "+966" },
  { code: "EG", name: "Egypt", currency: "EGP", calling: "+20" },
  { code: "TN", name: "Tunisia", currency: "TND", calling: "+216" },
  { code: "DZ", name: "Algeria", currency: "DZD", calling: "+213" },
  { code: "NG", name: "Nigeria", currency: "NGN", calling: "+234" },
  { code: "KE", name: "Kenya", currency: "KES", calling: "+254" },
  { code: "TR", name: "Türkiye", currency: "TRY", calling: "+90" },
  { code: "RU", name: "Russia", currency: "RUB", calling: "+7" },
  { code: "IN", name: "India", currency: "INR", calling: "+91" },
  { code: "PK", name: "Pakistan", currency: "PKR", calling: "+92" },
  { code: "ID", name: "Indonesia", currency: "IDR", calling: "+62" },
  { code: "MY", name: "Malaysia", currency: "MYR", calling: "+60" },
  { code: "SG", name: "Singapore", currency: "SGD", calling: "+65" },
  { code: "CN", name: "China", currency: "CNY", calling: "+86" },
  { code: "JP", name: "Japan", currency: "JPY", calling: "+81" },
  { code: "KR", name: "South Korea", currency: "KRW", calling: "+82" },
  { code: "AU", name: "Australia", currency: "AUD", calling: "+61" },
  { code: "NZ", name: "New Zealand", currency: "NZD", calling: "+64" },
  { code: "BR", name: "Brazil", currency: "BRL", calling: "+55" },
  { code: "AR", name: "Argentina", currency: "ARS", calling: "+54" },
  { code: "ZA", name: "South Africa", currency: "ZAR", calling: "+27" },
  { code: "OTHER", name: "Somewhere else", currency: "USD", calling: "+" },
];

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "MAD", symbol: "DH", name: "Moroccan Dirham" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "EGP", symbol: "EGP", name: "Egyptian Pound" },
  { code: "TND", symbol: "DT", name: "Tunisian Dinar" },
  { code: "DZD", symbol: "DA", name: "Algerian Dinar" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ARS", symbol: "AR$", name: "Argentine Peso" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
];

export const currencyOf = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

/** The region the device says it is in, when the browser tells us. */
export function detectRegion() {
  let code = "";
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    code = (locale.split("-")[1] || "").toUpperCase();
  } catch {
    code = "";
  }
  if (!code) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const guess = tz.split("/")[1];
      if (guess) code = guess === "London" ? "GB" : guess.toUpperCase();
    } catch {
      code = "";
    }
  }
  const hit = COUNTRIES.find((c) => c.code === code);
  return hit || { code: "OTHER", name: "Somewhere else", currency: "USD", calling: "+" };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function currentMonthLabel() {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
