import { describe, expect, it } from 'vitest'
import type { Ingredient } from './recipe'
import { scaleIngredients } from './scale-ingredients'

const oil: Ingredient = { name: 'Oil', amount: 1.5, unit: 'tbsp', aisle: 'Other', originalText: '' }
const cumin: Ingredient = { name: 'Cumin seeds', amount: 0.5, unit: 'tsp', aisle: 'Masalas', originalText: '' }
const salt: Ingredient = { name: 'Salt', amount: null, unit: '', aisle: 'Masalas', originalText: 'Salt to taste' }
const recipe = { baseServings: 2, ingredients: [oil, cumin, salt] }

describe('scaling recipe ingredients', () => {
  it('calculates 2 → 4 → 2 from the saved amounts each time', () => {
    const first = scaleIngredients(recipe, 2)
    expect(scaleIngredients(recipe, 4).map(({ amount }) => amount)).toEqual([3, 1, null])
    expect(scaleIngredients(recipe, 2)).toEqual(first)
    expect(first).toEqual(recipe.ingredients)
    expect(first[0]).not.toBe(oil)
  })

  it('retains fractional precision until display', () => {
    const [scaled] = scaleIngredients({ baseServings: 3, ingredients: [cumin] }, 2)
    expect(scaled.amount).toBe(1 / 3)
  })

  it('preserves original text for to-taste entries and ranges', () => {
    const range: Ingredient = { ...oil, name: 'Onions', amount: null, unit: '', originalText: '2–3 onions' }
    const measuredSalt = { ...salt, amount: 0.5, unit: 'tsp' as const }
    const water: Ingredient = { ...oil, name: 'Water', unit: 'cup', originalText: 'Water as needed' }
    expect(scaleIngredients({ baseServings: 2, ingredients: [measuredSalt, range, water] }, 4)).toEqual([
      { ...measuredSalt, amount: null }, range, { ...water, amount: null },
    ])
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects invalid serving count %s', (count) => {
    expect(() => scaleIngredients(recipe, count)).toThrow(RangeError)
    expect(() => scaleIngredients({ ...recipe, baseServings: count }, 2)).toThrow(RangeError)
  })

  it('keeps zero and avoids non-finite results', () => {
    const amounts = [0, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]
    const ingredients = amounts.map((amount) => ({ ...cumin, amount }))
    expect(scaleIngredients({ baseServings: 2, ingredients }, 4).map(({ amount }) => amount)).toEqual([0, null, null, null])
  })
})
