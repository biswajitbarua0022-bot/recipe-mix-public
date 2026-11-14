import { describe, expect, it } from 'vitest'
import type { MealSlot } from '../data/organizer'
import type { Ingredient, Recipe } from '../recipes/recipe'
import { emptyGroceryWeek, generateItems, groceryRecipeChanged, hasDuplicateItem, remainingListText, retainGeneratedStatus } from './grocery-list'

function ingredient(name: string, amount: number | null, unit: Ingredient['unit'] = '', originalText = ''): Ingredient {
  return { name, amount, unit, originalText, aisle: 'Vegetables & herbs' }
}

function recipe(id: string, ingredients: Ingredient[]): Recipe {
  return { id, title: id, baseServings: 2, prepMinutes: 5, cookMinutes: 10, cuisine: 'North Indian', meal: 'Dinner', diet: 'Veg', favourite: false, createdAt: 1, steps: ['Cook.'], ingredients }
}

function slot(date: string, recipeId: string, servings: number): MealSlot {
  return { date, meal: 'Dinner', recipeId, servings }
}

describe('weekly grocery items', () => {
  it('merges explicit aliases in matching units and keeps incompatible units and powders separate', () => {
    const first = recipe('Dal', [ingredient('Onions', 1), ingredient('jeera', .5, 'tsp'), ingredient('Cumin powder', .5, 'tsp')])
    const second = recipe('Rice', [ingredient('onion', 1), ingredient('Onion', 100, 'g'), ingredient('Cumin seeds', 1, 'tsp')])
    const rows = generateItems([slot('2026-01-05', 'Dal', 4), slot('2026-01-06', 'Rice', 2)], [first, second])
    expect(rows.map(({ canonical, unit, amount }) => [canonical, unit, amount])).toEqual([
      ['onion', '', 3], ['cumin seeds', 'tsp', 2], ['cumin powder', 'tsp', 1], ['onion', 'g', 100],
    ])
    expect(rows[0].sources.map(({ date, amount }) => [date, amount])).toEqual([['2026-01-05', 2], ['2026-01-06', 1]])
  })

  it('keeps each ambiguous line verbatim and each repeat tied to its meal slot', () => {
    const soup = recipe('Soup', [ingredient('Onions', null, '', '2–3 onions'), ingredient('Salt', null, '', 'salt to taste')])
    const rows = generateItems([slot('2026-01-05', 'Soup', 2), slot('2026-01-06', 'Soup', 4)], [soup])
    expect(rows.map(({ amount, originalText }) => [amount, originalText])).toEqual([[null, '2–3 onions'], [null, 'salt to taste'], [null, '2–3 onions'], [null, 'salt to taste']])
    expect(new Set(rows.map(({ id }) => id)).size).toBe(4)
    expect(rows.map(({ sources }) => sources[0].servings)).toEqual([2, 2, 4, 4])
  })

  it('retains checked or cleared state only when the quantities and meal contributions match', () => {
    const dal = recipe('Dal', [ingredient('Onions', 1), ingredient('Oil', 2, 'tbsp')])
    const rice = recipe('Rice', [ingredient('Rice', 1, 'cup')])
    const meals = [slot('2026-01-05', 'Dal', 2), slot('2026-01-06', 'Dal', 4), slot('2026-01-07', 'Rice', 2)]
    const before = generateItems(meals, [dal, rice]).map((item) => ({ ...item, status: item.canonical === 'oil' ? 'cleared' as const : 'checked' as const }))
    expect(retainGeneratedStatus(generateItems([...meals].reverse(), [rice, dal]), before).map(({ status }) => status)).toEqual(['checked', 'cleared', 'checked'])
    const changed = generateItems([{ ...meals[0], servings: 4 }, { ...meals[1], servings: 2 }, meals[2]], [dal, rice])
    expect(changed[0].amount).toBe(before[0].amount)
    expect(retainGeneratedStatus(changed, before).map(({ status }) => status)).toEqual(['unchecked', 'unchecked', 'checked'])
    const moved = generateItems([{ ...meals[0], date: '2026-01-08' }, meals[1], meals[2]], [dal, rice])
    expect(retainGeneratedStatus(moved, before).find(({ canonical }) => canonical === 'onion')?.status).toBe('unchecked')
  })

  it('uses unrounded amounts for snapshots and formats only the remaining items for sharing', () => {
    const soup = { ...recipe('Soup', [ingredient('Onion', 1), ingredient('Salt', null, '', 'salt to taste'), ingredient('Garlic', 1), ingredient('Oil', 2, 'tbsp')]), baseServings: 3 }
    const rows = generateItems([slot('2026-01-05', 'Soup', 1)], [soup])
    expect(rows.find(({ canonical }) => canonical === 'onion')?.amount).toBe(1 / 3)
    const week = { ...emptyGroceryWeek('2026-01-05'), rows: rows.map((item) => ({ ...item, status: item.canonical === 'garlic' ? 'checked' as const : item.canonical === 'oil' ? 'cleared' as const : 'unchecked' as const })) }
    expect(remainingListText(week)).toContain('⅓ Onion')
    expect(remainingListText(week)).toContain('salt to taste')
    expect(remainingListText(week)).not.toMatch(/garlic|oil/i)
    expect(hasDuplicateItem(week, 'onions', '')).toBe(true)
    expect(hasDuplicateItem(week, 'onions', '100 grams')).toBe(false)
  })

  it('flags recipe changes that affect a grocery snapshot', () => {
    const dal = recipe('Dal', [ingredient('Onion', 1)])
    expect(groceryRecipeChanged(dal, { ...dal, steps: ['Fry.'], favourite: true, cookMinutes: 20 })).toBe(false)
    expect(groceryRecipeChanged(dal, { ...dal, title: 'Family Dal' })).toBe(true)
    expect(groceryRecipeChanged(dal, { ...dal, baseServings: 4 })).toBe(true)
    expect(groceryRecipeChanged(dal, { ...dal, ingredients: [ingredient('Onion', 2)] })).toBe(true)
  })
})
