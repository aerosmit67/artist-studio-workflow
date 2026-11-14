// Cost-based pricing (PRD §8.4). All inputs are the artist's estimates.
export interface PricingInputs {
  hours: number
  hourlyWage: number
  clayWeight: number // lbs (or any unit matching clayCostPerUnit)
  clayCostPerUnit: number
  glazeCost: number
  firingFee: number
  otherCosts: number
  profitPct: number // margin added on top of costs for wholesale
  commissionPct: number // gallery consignment cut of retail, e.g. 50
}

export interface PricingResult {
  labor: number
  materials: number
  totalCost: number
  wholesale: number
  retail: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

/** Wholesale = (labor + materials) × (1 + profit%). Retail is set so that
 *  after the gallery takes commission% the artist still nets wholesale:
 *  retail = wholesale ÷ (1 − commission%). A 50/50 split doubles wholesale. */
export function calculatePrice(i: PricingInputs): PricingResult {
  const labor = n(i.hours) * n(i.hourlyWage)
  const materials = n(i.clayWeight) * n(i.clayCostPerUnit) + n(i.glazeCost) + n(i.firingFee) + n(i.otherCosts)
  const totalCost = labor + materials
  const wholesale = totalCost * (1 + n(i.profitPct) / 100)
  const c = Math.min(95, n(i.commissionPct))
  const retail = wholesale / (1 - c / 100)
  return { labor: r2(labor), materials: r2(materials), totalCost: r2(totalCost), wholesale: r2(wholesale), retail: r2(retail) }
}
