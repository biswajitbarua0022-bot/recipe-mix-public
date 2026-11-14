import type { Unit } from './recipe'

const unitNames: Readonly<Record<string, Unit>> = {
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup', piece: 'piece', pieces: 'piece', clove: 'clove', cloves: 'clove',
  pinch: 'pinch', pinches: 'pinch', medium: 'medium', sprig: 'sprig', sprigs: 'sprig', bunch: 'bunch', bunches: 'bunch',
}

export function normalizeUnit(value: string): Unit | undefined {
  const key = value.trim().toLowerCase().replace(/\.$/, '')
  if (!key) return ''
  return Object.hasOwn(unitNames, key) ? unitNames[key] : undefined
}

const fractions = [
  [1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 5, '⅕'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'],
  [2 / 5, '⅖'], [1 / 2, '½'], [3 / 5, '⅗'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'],
  [4 / 5, '⅘'], [5 / 6, '⅚'], [7 / 8, '⅞'],
] as const
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
const plurals: Partial<Record<Unit, string>> = { cup: 'cups', piece: 'pieces', clove: 'cloves', pinch: 'pinches', sprig: 'sprigs', bunch: 'bunches' }

export function formatQuantity(amount: number, unit: Unit) {
  const whole = Math.floor(amount)
  const fraction = fractions.find(([value]) => Math.abs(amount - whole - value) < 1e-8)
  const number = fraction ? `${whole ? numberFormat.format(whole) : ''}${fraction[1]}`
    : amount > 0 && amount < 0.005 ? '<0.01' : numberFormat.format(amount)
  const label = amount > 1 ? plurals[unit] ?? unit : unit
  return label ? `${number} ${label}` : number
}
