import { parseAmount, wholeNumber } from './editor-draft'
import { normalizeUnit } from './ingredient-unit'
import type { Aisle, Ingredient, Unit } from './recipe'

type Section = 'ingredients' | 'steps'
export type ParsedIngredient = Omit<Ingredient, 'amount'> & { amount: string; reviewNote?: string }

export type ParsedRecipe = {
  title: string
  servings: string
  prepMinutes: string
  cookMinutes: string
  titleSource?: string
  timeSources: string[]
  ingredients: ParsedIngredient[]
  steps: string[]
  unassigned: string[]
}

const ingredientHeading = /^(?:ingredients?|ingredient list|what (?:you(?:'|’)ll|you will) need)\s*(?::\s*(.*))?$/i
const methodHeading = /^(?:method|directions|instructions|steps|preparation|how to make|cooking instructions)\s*(?::\s*(.*))?$/i
const listMarker = /^(?:[•●▪◦‣]\s*|[-*+–—]\s+|step\s+\d+\s*[.):]\s*|(?:\d+\)|\(\d+\))\s*|\d+[.:]\s+)/i
const markup = /<[!/?a-z]/i
const amountPrefix = /^(?<amount>\d+\s+\d+\s*[/⁄]\s*\d+|\d+\s*[/⁄]\s*\d+|\d*\s*[¼-¾⅐-⅞]|\d+(?:\.\d+)?|\.\d+)(?<gap>\s*)(?<rest>.*)$/u
const vaguePrefix = /^(?:a\s+)?(?:handful|splash|dash|knob|pinch|little|few|some)\b\s*(?:of\s+)?/i
const unsupportedMeasure = /^(?:handfuls?|splashes?|dashes|dash|knobs?|packets?|packs?|bags?|jars?|bottles?|cans?|oz|ounces?|lbs?|pounds?)\b\s+/i
const toTaste = /(?:\s*,\s*|\s+|\s*\()\s*(?:to taste|as needed)\)?[.!]?$/i
const optional = /(?:\s*\(optional\)|,\s*optional)$/i

const aisleHints: Readonly<Record<string, Aisle>> = {
  'toor dal': 'Dals, rice & grains', rice: 'Dals, rice & grains', poha: 'Dals, rice & grains',
  ghee: 'Dairy & eggs', butter: 'Dairy & eggs', milk: 'Dairy & eggs', eggs: 'Dairy & eggs',
  onion: 'Vegetables & herbs', onions: 'Vegetables & herbs', garlic: 'Vegetables & herbs',
  tomato: 'Vegetables & herbs', tomatoes: 'Vegetables & herbs', 'curry leaves': 'Vegetables & herbs',
  'coriander leaves': 'Vegetables & herbs', dhaniya: 'Vegetables & herbs', lemon: 'Fruit',
  'cumin seeds': 'Masalas', jeera: 'Masalas', turmeric: 'Masalas', haldi: 'Masalas', hing: 'Masalas', salt: 'Masalas',
}

export function withoutListMarker(line: string) {
  return line.trim().replace(listMarker, '').trim()
}

function quantity(text: string) {
  return amountPrefix.exec(text)?.groups
}

function unitAtStart(text: string): { unit: Unit; name: string } {
  const prefix = /^([a-z]+)\.?\s+(?:of\s+)?(.+)$/i.exec(text)
  const unit = prefix && normalizeUnit(prefix[1])
  return prefix && unit
    ? { unit, name: prefix[2] }
    : { unit: '', name: text }
}

function ingredientName(text: string) {
  const name = text.replace(/,\s*(?:(?:finely|roughly|thinly)\s+)?(?:chopped|sliced|minced|grated|divided|rinsed|crushed|peeled|diced)\b.*$/i, '').trim()
  if (!/^\p{L}/u.test(name) || /[,:;!?=<>+&]|\b(?:and|or)\b/i.test(name)) return ''
  if (/^(?:add|stir|cook|serve|heat|wash|adjust|set)\b/i.test(name)) return ''
  return name
}

export function parseIngredientLine(originalText: string): ParsedIngredient {
  let text = withoutListMarker(originalText)
  const unclear = (reviewNote: string): ParsedIngredient => ({ name: '', amount: '', unit: '', aisle: 'Other', originalText, reviewNote })
  if (markup.test(text)) return unclear('Review this line as plain text.')

  const isOptional = optional.test(text)
  text = text.replace(optional, '')
  const isToTaste = toTaste.test(text)
  text = text.replace(toTaste, '')
  const loose = vaguePrefix.exec(text)
  if (loose) text = text.slice(loose[0].length)

  const leading = quantity(text)
  const range = leading && /^(?:[-–—]\s*|(?:to|or)\s+)/i.exec(leading.rest)
  const rangeEnd = range && quantity(leading.rest.slice(range[0].length))
  if (range && !rangeEnd) return unclear('Check the amount range and enter the ingredient name.')

  const measured = rangeEnd || leading
  const unsupported = measured && unsupportedMeasure.exec(measured.rest)
  const ingredient = measured
    ? unitAtStart(unsupported ? measured.rest.slice(unsupported[0].length) : measured.rest)
    : { unit: '' as const, name: text }
  const { unit } = ingredient
  if (measured && !measured.gap && !unit) return unclear('Check where the amount ends and the ingredient begins.')

  let name = ingredientName(ingredient.name)
  let normalizedUnit = unit
  if (measured && !unit && normalizeUnit(name)) {
    return unclear('Check whether this word is a unit or an ingredient name.')
  }
  if (measured && !unit) {
    const trailingUnit = /^(.+?)\s+(cloves?|sprigs?|pieces?|bunch(?:es)?)$/i.exec(name)
    if (trailingUnit) {
      name = trailingUnit[1]
      normalizedUnit = normalizeUnit(trailingUnit[2]) ?? ''
    }
  }
  if (!name || /^(?:to taste|as needed)$/i.test(name)) return unclear('Check this line and enter an ingredient name.')

  const amount = measured && parseAmount(measured.amount)
  if (measured && !Number.isFinite(amount)) return unclear('Check this quantity and enter an exact amount if you know it.')
  const unquantified = isToTaste || range || loose || unsupported
  const reviewNote = range ? 'Check the range. Leave the amount blank or enter one exact quantity.'
    : loose || unsupported ? 'Check this measure and enter an exact amount if you know it.'
      : isOptional ? 'The original marks this ingredient as optional.' : undefined

  return {
    name, amount: measured && !unquantified ? measured.amount : '',
    unit: isToTaste || loose || unsupported ? '' : normalizedUnit,
    aisle: Object.hasOwn(aisleHints, name.toLowerCase()) ? aisleHints[name.toLowerCase()] : 'Other',
    originalText, reviewNote,
  }
}

function headingText(line: string) {
  return line.replace(/^#{1,6}\s+/, '').replace(/\s+#+$/, '').replace(/^(?:\*\*|__)(.+)(?:\*\*|__)$/, '$1').trim()
}

function looksLikeTitle(text: string) {
  return text.length <= 90 && /^\p{L}/u.test(text) && !/[.:;!?]/.test(text) && !/\bto taste\b/i.test(text)
    && !/^(?:add|stir|cook|serve|serves|servings|prep|yield|heat|wash|adjust|set)\b/i.test(text)
}

function readTimes(text: string, recipe: ParsedRecipe) {
  const timePattern = /\b(prep(?:aration)?|cook(?:ing)?)(?:\s+time)?\s*:?\s*(\d+)\s*(?:minutes?|mins?|m)\b\.?/gi
  const matches = Array.from(text.matchAll(timePattern))
  if (matches.length === 0 || text.replace(timePattern, '').replace(/\band\b|[\s,;·]/gi, '')) return false

  const values: Partial<Pick<ParsedRecipe, 'prepMinutes' | 'cookMinutes'>> = {}
  for (const [, label, value] of matches) {
    const key = label.toLowerCase().startsWith('prep') ? 'prepMinutes' : 'cookMinutes'
    if (recipe[key] || values[key] || !Number.isSafeInteger(wholeNumber(value))) return false
    values[key] = value
  }
  Object.assign(recipe, values)
  recipe.timeSources.push(text)
  return true
}

export function parseRecipe(source: string): ParsedRecipe {
  const recipe: ParsedRecipe = { title: '', servings: '', prepMinutes: '', cookMinutes: '', timeSources: [], ingredients: [], steps: [], unassigned: [] }
  const lines = source.split(/\r\n?|\n|[\u2028\u2029]/u).map((line) => line.trim()).filter(Boolean)
  const hasSections = lines.some((line) => ingredientHeading.test(headingText(line)) || methodHeading.test(headingText(line)))
  let section: Section | null = null

  for (const [index, original] of lines.entries()) {
    const text = headingText(original)
    if (markup.test(text)) {
      recipe.unassigned.push(original)
      continue
    }

    const ingredients = ingredientHeading.exec(text)
    const method = methodHeading.exec(text)
    if (ingredients || method) {
      section = ingredients ? 'ingredients' : 'steps'
      const inline = (ingredients ?? method)?.[1]
      if (inline?.trim()) {
        if (ingredients) recipe.ingredients.push({ ...parseIngredientLine(inline), originalText: original })
        else recipe.steps.push(withoutListMarker(inline))
      }
    } else if (section === 'ingredients') {
      recipe.ingredients.push(parseIngredientLine(original))
    } else if (section === 'steps') {
      recipe.steps.push(withoutListMarker(original))
    } else {
      const servings = /^(?:serves|servings|yields?)\s*:?\s*(\d+)(?:\s+(?:people|servings))?$/i.exec(text)
      if (servings && !recipe.servings && wholeNumber(servings[1]) > 0) {
        recipe.servings = servings[1]
        continue
      }
      if (readTimes(text, recipe)) continue

      const explicitTitle = /^(?:title|recipe)\s*:\s*(.+)$/i.exec(text)
      const title = explicitTitle?.[1] ?? text
      const suffix = /\s*\(serves\s+(\d+)\)$/i.exec(title)
      if (!recipe.title && (explicitTitle || (index === 0 && hasSections && looksLikeTitle(title)))) {
        recipe.title = suffix ? title.slice(0, suffix.index).trim() : title
        recipe.titleSource = original
        if (suffix && wholeNumber(suffix[1]) > 0) recipe.servings = suffix[1]
      } else {
        recipe.unassigned.push(original)
      }
    }
  }
  return recipe
}
