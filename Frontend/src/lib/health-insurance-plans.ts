export const HEALTH_INSURANCE_PLANS = [
  "Unimed",
  "Amil",
  "SulAmérica",
  "Bradesco Saúde",
  "NotreDame Intermédica",
  "Hapvida",
  "São Francisco",
  "Porto Seguro Saúde",
  "Prevent Senior",
  "Golden Cross",
] as const;

export type HealthInsurancePlan = (typeof HEALTH_INSURANCE_PLANS)[number];
