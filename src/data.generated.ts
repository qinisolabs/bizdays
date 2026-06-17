// AUTO-GENERATED from data/*.json by scripts/gen-data.mjs — do not edit by hand.
export interface WeekendOverride {
  weekend: number[];
  cldr: number[];
  reason: string;
  source: string;
}

export const WEEKEND_OVERRIDES: Record<string, WeekendOverride> = {
  "BD": {
    "weekend": [
      5,
      6
    ],
    "cldr": [
      6,
      7
    ],
    "reason": "Bangladesh's official weekly holiday is Friday & Saturday; CLDR still reports Sat/Sun.",
    "source": "Government of Bangladesh weekly holiday (Friday-Saturday)"
  },
  "NP": {
    "weekend": [
      6
    ],
    "cldr": [
      6,
      7
    ],
    "reason": "Nepal observes a single weekly day off (Saturday); CLDR reports Sat/Sun.",
    "source": "Nepal official weekly holiday (Saturday only)"
  }
};

export const TIER1: string[] = ["US","CA","MX","BR","AR","GB","IE","FR","DE","IT","ES","PT","NL","BE","LU","AT","CH","DK","SE","NO","FI","PL","CZ","SK","HU","RO","BG","GR","HR","SI","EE","LV","LT","CY","MT","RU","TR","ZA","EG","NG","KE","SA","AE","QA","KW","OM","BH","IL","JO","IR","IN","BD","NP","PK","CN","JP","KR","ID","SG","MY","TH","PH","VN","AU","NZ"];
