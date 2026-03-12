export const ASEAN_COUNTRY_CODES = [
  "BRN",
  "KHM",
  "IDN",
  "LAO",
  "MYS",
  "MMR",
  "PHL",
  "SGP",
  "THA",
  "TLS",
  "VNM",
] as const;

export type AseanCountryCode = (typeof ASEAN_COUNTRY_CODES)[number];

export interface AseanCountryDefinition {
  code: AseanCountryCode;
  label: string;
  aliases: string[];
  newsQuery: string;
  order: number;
}

export const ASEAN_COUNTRIES: AseanCountryDefinition[] = [
  {
    code: "BRN",
    label: "Brunei",
    aliases: ["Brunei", "Brunei Darussalam"],
    newsQuery: "\"Brunei\" economy inflation trade budget central bank growth",
    order: 1,
  },
  {
    code: "KHM",
    label: "Cambodia",
    aliases: ["Cambodia", "Cambodian", "Kingdom of Cambodia"],
    newsQuery: "\"Cambodia\" economy inflation trade budget central bank growth",
    order: 2,
  },
  {
    code: "IDN",
    label: "Indonesia",
    aliases: ["Indonesia", "Indonesian", "Republic of Indonesia"],
    newsQuery: "\"Indonesia\" economy inflation trade budget central bank growth",
    order: 3,
  },
  {
    code: "LAO",
    label: "Laos",
    aliases: ["Laos", "Lao PDR", "Lao", "Laotian"],
    newsQuery: "\"Laos\" economy inflation trade budget central bank growth",
    order: 4,
  },
  {
    code: "MYS",
    label: "Malaysia",
    aliases: ["Malaysia", "Malaysian"],
    newsQuery: "\"Malaysia\" economy inflation trade budget central bank growth",
    order: 5,
  },
  {
    code: "MMR",
    label: "Myanmar",
    aliases: ["Myanmar", "Burma", "Burmese"],
    newsQuery: "\"Myanmar\" OR Burma economy inflation trade budget central bank growth",
    order: 6,
  },
  {
    code: "PHL",
    label: "Philippines",
    aliases: ["Philippines", "Philippine", "Filipino"],
    newsQuery: "\"Philippines\" economy inflation trade budget central bank growth",
    order: 7,
  },
  {
    code: "SGP",
    label: "Singapore",
    aliases: ["Singapore", "Singaporean"],
    newsQuery: "\"Singapore\" economy inflation trade budget central bank growth",
    order: 8,
  },
  {
    code: "THA",
    label: "Thailand",
    aliases: ["Thailand", "Thai", "Kingdom of Thailand"],
    newsQuery: "\"Thailand\" economy inflation trade budget central bank growth",
    order: 9,
  },
  {
    code: "TLS",
    label: "Timor-Leste",
    aliases: ["Timor-Leste", "Timor Leste", "East Timor"],
    newsQuery: "\"Timor-Leste\" OR \"East Timor\" economy inflation trade budget central bank growth",
    order: 10,
  },
  {
    code: "VNM",
    label: "Vietnam",
    aliases: ["Vietnam", "Viet Nam", "Vietnamese"],
    newsQuery: "\"Vietnam\" economy inflation trade budget central bank growth",
    order: 11,
  },
];

const countriesByCode = new Map(
  ASEAN_COUNTRIES.map((country) => [country.code, country]),
);

export function isAseanCountryCode(value: string): value is AseanCountryCode {
  return countriesByCode.has(value as AseanCountryCode);
}

export function getAseanCountry(countryCode: string) {
  return countriesByCode.get(countryCode as AseanCountryCode) ?? null;
}
