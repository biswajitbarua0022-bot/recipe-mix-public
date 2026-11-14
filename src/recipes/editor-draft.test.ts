import { describe, expect, it } from 'vitest'
import { starterRecipes } from '../data/starter-recipes'
import { createDraft, parseAmount, validateDraft } from './editor-draft'

describe('manual quantities', () => {
  it.each([['', null], ['0', 0], ['.5', .5], ['½', .5], ['1 1/2', 1.5], ['1½', 1.5], ['1e-7', 1e-7]])('reads %j as %j', (text, amount) => {
    expect(parseAmount(text)).toBe(amount)
  })
})

describe('manual recipe validation', () => {
  it('round-trips a saved recipe with unquantified ingredients and ordered steps', () => {
    const starter = starterRecipes[0]
    const { recipe, errors } = validateDraft(createDraft(starter))
    expect(errors).toEqual({})
    expect(recipe?.ingredients).toEqual(starter.ingredients)
    expect(recipe?.steps).toEqual(starter.steps)
    expect(recipe?.baseServings).toBe(starter.baseServings)
  })

  it('reports incomplete rows, ranges, negative times, zero servings and empty method', () => {
    const draft = createDraft()
    draft.baseServings = '0'
    draft.prepMinutes = '-1'
    draft.cookMinutes = '0'
    draft.ingredients[0].amount = '1–2'
    const { recipe, errors } = validateDraft(draft)
    expect(recipe).toBeNull()
    expect(Object.keys(errors)).toEqual(['title', 'baseServings', 'prepMinutes', `name-${draft.ingredients[0].id}`, `amount-${draft.ingredients[0].id}`, 'steps'])
  })
})
