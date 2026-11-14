import { describe, expect, it } from 'vitest'
import { starterRecipes } from '../data/starter-recipes'
import { emptyFilters, filterRecipes } from './filter-recipes'

describe('Recipe Box filters', () => {
  it('keeps all recipes in display order when the search is blank', () => {
    expect(filterRecipes(starterRecipes, '  ', emptyFilters, false)).toEqual(starterRecipes)
  })

  it('matches titles, ingredient names and original text regardless of case', () => {
    expect(filterRecipes(starterRecipes, '  DAL TADKA ', emptyFilters, false).map(({ id }) => id)).toEqual(['dal-tadka'])
    expect(filterRecipes(starterRecipes, 'Curry Leaves', emptyFilters, false).map(({ id }) => id)).toEqual(['poha', 'upma', 'lemon-rice'])
    expect(filterRecipes(starterRecipes, 'salt to taste', emptyFilters, false)).toHaveLength(9)
  })

  it('combines cuisine, meal, diet, total time, ingredient and favourites', () => {
    const filters = { cuisine: 'North Indian', meal: 'Dinner', diet: 'Veg', time: 45 } as const
    expect(filterRecipes(starterRecipes, 'onion', filters, true).map(({ id }) => id)).toEqual(['dal-tadka'])
    expect(filterRecipes(starterRecipes, 'lemon', filters, true)).toEqual([])
    expect(filterRecipes(starterRecipes, 'onion', { ...filters, diet: 'Non-veg' }, false)).toEqual([])
  })

  it('uses the sum of prep and cook times and excludes the boundary for Under labels', () => {
    expect(filterRecipes(starterRecipes, '', { ...emptyFilters, time: 20 }, false).map(({ id }) => id)).toEqual(['lemon-rice'])
    expect(filterRecipes(starterRecipes, '', { ...emptyFilters, time: 30 }, false).map(({ id }) => id)).toEqual(['poha', 'upma', 'jeera-rice', 'lemon-rice', 'egg-bhurji'])
  })
})
