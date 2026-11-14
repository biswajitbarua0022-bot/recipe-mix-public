import { describe, expect, it } from 'vitest'
import { parseAmount } from './editor-draft'
import { parseIngredientLine, parseRecipe } from './parse-recipe'

describe('pasted recipes', () => {
  it('reads headed recipes with metadata, bullets and numbered steps in order', () => {
    const result = parseRecipe([
      'Dal Tadka (serves 4)', 'Prep 10 min, cook 25 minutes', '', '## Ingredients:',
      '• 1 cup toor dal', '- ½ teaspoon cumin seeds', '3. 4 garlic cloves, sliced', 'salt to taste',
      '**Directions:**', '1) Rinse the dal.', '(2)Simmer until tender.', 'Step 3: Stir in the tempering.',
    ].join('\r\n'))

    expect(result).toMatchObject({ title: 'Dal Tadka', servings: '4', prepMinutes: '10', cookMinutes: '25', unassigned: [] })
    expect(result.ingredients.map(({ name, amount, unit }) => ({ name, amount, unit }))).toEqual([
      { name: 'toor dal', amount: '1', unit: 'cup' },
      { name: 'cumin seeds', amount: '½', unit: 'tsp' },
      { name: 'garlic', amount: '4', unit: 'clove' },
      { name: 'salt', amount: '', unit: '' },
    ])
    expect(result.ingredients[3].originalText).toBe('salt to taste')
    expect(result.steps).toEqual(['Rinse the dal.', 'Simmer until tender.', 'Stir in the tempering.'])
  })

  it('retains lines with unclear boundaries, ranges and vague quantities', () => {
    const result = parseRecipe('Recipe: Weeknight dal\nThis is how my grandmother made it.\nIngredients\n2–3 onions\nA handful of dhaniya\nAdd what you like\n1 tsp\nInstructions: 1. Simmer.')
    expect(result.unassigned).toEqual(['This is how my grandmother made it.'])
    expect(result.steps).toEqual(['Simmer.'])
    expect(result.ingredients).toMatchObject([
      { name: 'onions', amount: '', originalText: '2–3 onions', reviewNote: expect.any(String) },
      { name: 'dhaniya', amount: '', originalText: 'A handful of dhaniya', reviewNote: expect.any(String) },
      { name: '', amount: '', originalText: 'Add what you like', reviewNote: expect.any(String) },
      { name: '', amount: '', originalText: '1 tsp', reviewNote: expect.any(String) },
    ])
    const headingless = ['Kitchen notes', '1 cup rice', 'Cook the rice.']
    expect(parseRecipe(headingless.join('\n'))).toMatchObject({ ingredients: [], steps: [], unassigned: headingless })
    expect(parseIngredientLine('1 tbsp oil + ½ tsp cumin seeds')).toMatchObject({ name: '', amount: '', reviewNote: expect.any(String) })
  })

  it.each([['½', .5], ['1/2', .5], ['1 1/2', 1.5], ['1½', 1.5], ['2 ⅓', 2 + 1 / 3], ['.5', .5]])('proposes the fraction %s as %s', (amount, expected) => {
    const ingredient = parseIngredientLine(`${amount} tbsp ghee`)
    expect(ingredient).toMatchObject({ name: 'ghee', unit: 'tbsp' })
    expect(parseAmount(ingredient.amount)).toBe(expected)
  })

  it('keeps markup verbatim instead of interpreting HTML tags, attributes or entities', () => {
    const lines = ['<h2>Ingredients</h2>', '<img src=x onerror="alert(1)">', '<script>alert(1)</script>', '<li>1 cup rice &amp; peas</li>']
    expect(parseRecipe(lines.join('\n'))).toMatchObject({ title: '', ingredients: [], steps: [], unassigned: lines })
    expect(parseIngredientLine('½ tsp <b>salt</b>')).toMatchObject({ name: '', originalText: '½ tsp <b>salt</b>' })
  })
})
