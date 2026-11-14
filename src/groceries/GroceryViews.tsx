import { Link2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { orderSlots, slotKey } from '../data/organizer'
import { formatSlotDate, formatWeekday } from '../planner/calendar'
import { formatQuantity } from '../recipes/ingredient-unit'
import type { Unit } from '../recipes/recipe'
import { RecipeImage } from '../recipes/RecipeImage'
import { aisleNames, groceryItemName, groupByAisle } from './grocery-list'
import type { Contribution, GeneratedItem, GroceryItem, ManualItem } from './grocery-list'

type RowActions = {
  busy: boolean
  onCheck: (item: GroceryItem, checked: boolean) => void
  onRemove: (item: ManualItem) => void
}

function sourceLabels(sources: Contribution[], unit: Unit) {
  return sources.map((source) => {
    const repeated = sources.some((other) => other !== source && other.title === source.title)
    const meal = repeated ? `${source.title} (${formatWeekday(source.date)} ${source.meal.toLowerCase()})` : source.title
    return source.amount === null ? meal : `${meal} ${formatQuantity(source.amount, unit)}`
  }).join(' + ')
}

function GroceryRow({ item, source, otherUnits, busy, onCheck, onRemove }: RowActions & {
  item: GroceryItem
  source?: Contribution
  otherUnits?: Unit[]
}) {
  const name = groceryItemName(item)
  const checked = item.status === 'checked'
  const amount = item.kind === 'generated' ? source ? source.amount : item.amount : null
  const quantity = item.kind === 'manual' ? item.quantityText : amount === null ? '' : formatQuantity(amount, item.unit)
  const shared = item.kind === 'generated' && item.sources.length > 1
  const summary = item.kind === 'generated' ? sourceLabels(item.sources, item.unit) : ''
  const original = item.kind === 'generated' && item.originalText !== name ? item.originalText : ''

  return (
    <li className={`grocery-row${checked ? ' is-checked' : ''}`}>
      <label className="grocery-check">
        <input type="checkbox" checked={checked} disabled={busy} aria-label={[name, quantity, original].filter(Boolean).join(', ')} onChange={(event) => onCheck(item, event.target.checked)} />
        <span className="grocery-row-body">
          <span className="grocery-row-title">
            <strong>{name}</strong>
            {shared && item.kind === 'generated' && <span className="grocery-badge shared"><Link2 size={12} aria-hidden="true" /> {source && item.amount !== null ? `Shared · ${formatQuantity(item.amount, item.unit)} total` : `${item.sources.length} meals`}</span>}
            {item.kind === 'manual' && <span className="grocery-badge">Added by you</span>}
          </span>
          {original && <span className="grocery-row-note original">{original}</span>}
          {item.kind === 'generated' && (!source || shared) && <span className="grocery-row-note">{source && shared ? 'Checks the shared item · ' : ''}{summary}</span>}
          {otherUnits && otherUnits.length > 0 && <span className="grocery-row-note separate-unit">Separate unit · also listed as {otherUnits.map((unit) => unit || 'a count').join(', ')}</span>}
        </span>
        {quantity && <strong className="grocery-quantity">{quantity}</strong>}
      </label>
      {item.kind === 'manual' && <button className="icon-button grocery-remove" type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={() => onRemove(item)}><X size={17} aria-hidden="true" /></button>}
    </li>
  )
}

function GroceryGroup({ title, subtitle, art, count, checked, children }: {
  title: string
  subtitle?: string
  art?: ReactNode
  count: number
  checked: number
  children: ReactNode
}) {
  return (
    <section className="grocery-group" aria-label={[title, subtitle].filter(Boolean).join(', ')}>
      <header>{art}<div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><span>{checked} of {count}</span></header>
      <ul role="list">{children}</ul>
    </section>
  )
}

function recipeGroups(items: GroceryItem[]) {
  const groups = new Map<string, { meal: Contribution; rows: { item: GeneratedItem; source: Contribution }[] }>()
  for (const item of items) {
    if (item.kind !== 'generated') continue
    for (const source of item.sources) {
      const key = JSON.stringify(slotKey(source))
      const group = groups.get(key) ?? { meal: source, rows: [] }
      group.rows.push({ item, source })
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((a, b) => orderSlots(a.meal, b.meal))
}

export function GroceryViews({ items, view, ...actions }: RowActions & { items: GroceryItem[]; view: 'aisle' | 'recipe' }) {
  const units = new Map<string, Set<Unit>>()
  for (const item of items) {
    if (item.kind !== 'generated' || item.amount === null) continue
    const distinct = units.get(item.canonical) ?? new Set<Unit>()
    distinct.add(item.unit)
    units.set(item.canonical, distinct)
  }
  const otherUnits = (item: GroceryItem) => item.kind === 'generated' && item.amount !== null
    ? [...(units.get(item.canonical) ?? [])].filter((unit) => unit !== item.unit) : undefined
  const checked = (rows: GroceryItem[]) => rows.filter(({ status }) => status === 'checked').length

  if (view === 'aisle') return <div className="grocery-groups">
    {groupByAisle(items).map(({ aisle, items: rows }) => (
      <GroceryGroup key={aisle} title={aisleNames[aisle]} count={rows.length} checked={checked(rows)}>
        {rows.map((item) => <GroceryRow key={item.id} item={item} otherUnits={otherUnits(item)} {...actions} />)}
      </GroceryGroup>
    ))}
  </div>

  const manualItems = items.filter((item) => item.kind === 'manual')
  return <div className="grocery-groups">
    {recipeGroups(items).map(({ meal, rows }) => (
      <GroceryGroup key={JSON.stringify(slotKey(meal))} title={meal.title} subtitle={`${formatSlotDate(meal.date)} · ${meal.meal.toLowerCase()} · serves ${meal.servings}`}
        count={rows.length} checked={checked(rows.map(({ item }) => item))} art={<div className="organizer-thumb"><RecipeImage photo={null} motif={meal.motif} /></div>}>
        {rows.map(({ item, source }) => <GroceryRow key={item.id} item={item} source={source} otherUnits={otherUnits(item)} {...actions} />)}
      </GroceryGroup>
    ))}
    {manualItems.length > 0 && <GroceryGroup title="Added by you" subtitle="Manual items" count={manualItems.length} checked={checked(manualItems)}>
      {manualItems.map((item) => <GroceryRow key={item.id} item={item} {...actions} />)}
    </GroceryGroup>}
  </div>
}
