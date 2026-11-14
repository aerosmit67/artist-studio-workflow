import { describe, expect, it } from 'vitest'
import { calculatePrice } from '@/studio/lib/pricing'

const base = { hours: 10, hourlyWage: 25, clayWeight: 5, clayCostPerUnit: 2, glazeCost: 15, firingFee: 20, otherCosts: 5, profitPct: 0, commissionPct: 50 }

describe('cost-based pricing', () => {
  it('adds labor (hours × wage) and materials (clay, glaze, firing, other)', () => {
    const r = calculatePrice(base)
    expect(r.labor).toBe(250)
    expect(r.materials).toBe(50)
    expect(r.totalCost).toBe(300)
  })
  it('a 50/50 consignment split doubles wholesale for retail', () => {
    expect(calculatePrice(base).retail).toBe(600)
  })
  it('applies profit margin to wholesale before commission', () => {
    const r = calculatePrice({ ...base, profitPct: 20, commissionPct: 40 })
    expect(r.wholesale).toBe(360)
    expect(r.retail).toBe(600)
  })
})
