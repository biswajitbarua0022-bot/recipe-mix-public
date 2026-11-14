import { formatQuantity } from './ingredient-unit'
import type { Ingredient } from './recipe'
import { unquantifiedQualifier } from './scale-ingredients'

export function IngredientList({ ingredients }: { ingredients: readonly Ingredient[] }) {
  return (
    <ul className="cooking-ingredients" role="list">
      {ingredients.map(({ name, amount, unit, originalText }, index) => {
        const qualifier = unquantifiedQualifier({ name, originalText })
        const quantity = amount === null ? qualifier ?? '—' : formatQuantity(amount, unit)
        const note = originalText !== name ? originalText : ''
        const hasSourceQuantity = amount !== null && /^(?:[-*+•●▪◦‣–—]\s*)?[\d¼-¾⅐-⅞]/u.test(note)
        return (
          <li key={index}>
            <strong className={qualifier ? 'unquantified' : undefined}>{quantity}</strong>
            <div><span>{name}</span>{note && <p>{hasSourceQuantity ? 'Original: ' : ''}{note}</p>}</div>
          </li>
        )
      })}
    </ul>
  )
}
