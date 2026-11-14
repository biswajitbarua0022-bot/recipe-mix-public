import { useRef, useState } from 'react'
import { AlertTriangle, BriefcaseBusiness, CircleCheck, Copy, Plus, RefreshCcw, Share2, ShoppingBasket, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { OrganizerDialog } from '../components/OrganizerDialog'
import { useOrganizerAction } from '../components/use-organizer-action'
import { addManualItem, clearCheckedItems, generateGroceryWeek, removeManualItem, setItemChecked } from '../data/grocery-store'
import type { ReadyLibrary } from '../data/use-recipe-library'
import { addDays, formatWeek, isPlannerDate, localDateKey, weekStart } from '../planner/calendar'
import { WeekBar } from '../planner/WeekControls'
import { aisles } from '../recipes/recipe'
import type { Aisle } from '../recipes/recipe'
import { aisleNames, emptyGroceryWeek, remainingListText, visibleItems } from './grocery-list'
import type { GroceryWeek } from './grocery-list'
import { GroceryViews } from './GroceryViews'
import { useGroceryWeek } from './use-grocery-week'
import './groceries.css'

export function GroceryStaleNotice({ busy, onRefresh, savedList }: { busy: boolean; onRefresh: () => void; savedList?: string }) {
  return (
    <div className="grocery-stale">
      <AlertTriangle size={20} aria-hidden="true" />
      <div><strong>Grocery list is out of date</strong><p>Your plan or recipes changed. Refresh when you’re ready to update the list.{savedList && <> <Link className="grocery-stale-link" to={savedList}>Open saved list</Link></>}</p></div>
      <button className="text-button" type="button" disabled={busy} onClick={onRefresh}><RefreshCcw size={16} aria-hidden="true" /> Refresh from plan</button>
    </div>
  )
}

type GroceryView = 'aisle' | 'recipe'

function GroceryPage({ library, date, view, onDate, onView }: {
  library: ReadyLibrary
  date: string
  view: GroceryView
  onDate: (date: string) => void
  onView: (view: GroceryView) => void
}) {
  const monday = weekStart(date)
  const { state, replace, retry } = useGroceryWeek(monday, library.state.mealSlots)
  const { busy, error, run } = useOrganizerAction()
  const [manualText, setManualText] = useState('')
  const [aisle, setAisle] = useState<Aisle>('Other')
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState('')
  const confirmation = useRef<HTMLDialogElement>(null)
  const copyField = useRef<HTMLTextAreaElement>(null)
  const snapshot = state.status === 'ready' ? state.snapshot : null
  const week = snapshot ?? emptyGroceryWeek(monday)
  const generated = week.generationId !== null
  const items = visibleItems(week)
  const checked = items.filter((item) => item.status === 'checked')
  const remainingText = remainingListText(week)
  const canWrite = state.status === 'ready' && !busy
  const sunday = addDays(monday, 6)
  const hasPlan = library.state.mealSlots.some((slot) => slot.date >= monday && slot.date <= sunday)
  const plannerLink = `/planner?date=${date}`
  const manualCount = week.manualItems.length
  const manualSummary = `${manualCount} ${manualCount === 1 ? 'item' : 'items'} you added`
  const summary = generated ? `Made from ${week.plannedMeals} planned ${week.plannedMeals === 1 ? 'meal' : 'meals'}${manualCount ? ` and ${manualSummary}` : ''}`
    : manualCount ? manualSummary : 'No list for this week yet'

  function changeList(action: string, write: () => Promise<GroceryWeek>) {
    setCopied(false)
    void run(action, async () => replace(await write()))
  }

  function generate() {
    changeList('generate the grocery list', () => generateGroceryWeek(monday))
  }

  async function copyList() {
    setCopied(false)
    try {
      await navigator.clipboard.writeText(remainingText)
      setCopied(true)
    } catch {
      setFallback(remainingText)
    }
  }

  const shareUrl = remainingText ? `https://wa.me/?${new URLSearchParams({ text: remainingText }).toString().replace(/\+/g, '%20')}` : ''

  return (
    <section className="groceries-page organizer-controls">
      <header className="collection-heading grocery-heading">
        <div><h1>Groceries</h1><p>{state.status === 'loading' ? 'Opening this week’s list…' : summary}</p></div>
        <div className="grocery-share">
          {shareUrl && !busy ? <a className="button" href={shareUrl} target="_blank" rel="noopener noreferrer"><Share2 size={16} aria-hidden="true" /> Share on WhatsApp</a>
            : <button type="button" className="button" disabled><Share2 size={16} aria-hidden="true" /> Share on WhatsApp</button>}
          <button type="button" className="button" disabled={busy || !remainingText} onClick={() => void copyList()}><Copy size={16} aria-hidden="true" /> Copy list</button>
        </div>
      </header>

      <WeekBar date={date} onSelect={onDate} disabled={busy} />
      {copied && <p className="grocery-copy-status" role="status"><CircleCheck size={16} aria-hidden="true" /> Remaining items copied.</p>}
      {state.status === 'error' && <div className="form-error" role="alert">Could not open this week’s grocery list. <button type="button" className="text-button" onClick={retry}>Try again</button></div>}
      {generated && week.stale && <GroceryStaleNotice busy={!canWrite} onRefresh={generate} />}
      {!generated && hasPlan && state.status === 'ready' && <div className="grocery-ready">
        <p>Your planned meals are ready to turn into a shopping list.</p>
        <button className="button primary-button" type="button" disabled={!canWrite} onClick={generate}><ShoppingBasket size={17} aria-hidden="true" /> Generate grocery list</button>
      </div>}

      <form className="grocery-add" onSubmit={(event) => {
        event.preventDefault()
        if (!canWrite) return
        changeList('add this item', async () => {
          const updated = await addManualItem(monday, manualText, aisle)
          setManualText('')
          return updated
        })
      }}>
        <label className="organizer-field grocery-add-name">Add item<input value={manualText} placeholder="e.g. Curd, 500 g" disabled={!canWrite} onChange={(event) => setManualText(event.target.value)} /></label>
        <label className="organizer-field grocery-add-aisle"><span className="grocery-sr-only">Aisle</span><select aria-label="Aisle" value={aisle} disabled={!canWrite} onChange={(event) => setAisle(event.target.value as Aisle)}>
          {aisles.map((item) => <option key={item} value={item}>{aisleNames[item]}</option>)}
        </select></label>
        <button className="button primary-button" type="submit" disabled={!canWrite || !manualText.trim()}><Plus size={18} aria-hidden="true" /> Add item</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      {state.status === 'ready' && (items.length ? <>
        <div className="grocery-progress">
          <div><p><CircleCheck size={17} aria-hidden="true" /> <strong>{checked.length} of {items.length} checked</strong></p>
            <button className="text-button" type="button" disabled={!canWrite || checked.length === 0} onClick={() => confirmation.current?.showModal()}><Trash2 size={16} aria-hidden="true" /> Clear checked</button></div>
          <progress aria-label="Grocery items checked" max={items.length} value={checked.length} />
        </div>
        <div className="grocery-view-options" role="group" aria-label="Grocery list view">
          <button type="button" aria-pressed={view === 'aisle'} onClick={() => onView('aisle')}><ShoppingBasket size={17} aria-hidden="true" /> By aisle</button>
          <button type="button" aria-pressed={view === 'recipe'} onClick={() => onView('recipe')}><BriefcaseBusiness size={17} aria-hidden="true" /> By recipe</button>
        </div>
        <GroceryViews items={items} view={view} busy={!canWrite} onCheck={(item, value) => changeList('update this item', () => setItemChecked(monday, item.id, value, week.generationId))}
          onRemove={(item) => changeList('remove this item', () => removeManualItem(monday, item.id))} />
      </> : <div className="grocery-empty">
        <ShoppingBasket size={52} aria-hidden="true" />
        <h2>{!hasPlan && !generated ? `Nothing planned for ${formatWeek(monday)}` : 'Nothing on the grocery list'}</h2>
        <p>{hasPlan && !generated ? 'Generate the list from your plan, or add an item above.' : 'Add an item above or plan meals to build your list.'}</p>
        <Link className="button" to={plannerLink}>Plan meals for this week</Link>
      </div>)}

      <ConfirmDialog dialogRef={confirmation} title={`Clear ${checked.length} checked ${checked.length === 1 ? 'item' : 'items'}?`}
        description="Cleared plan items stay hidden unless their quantities or meal contributions change. Checked items you added are removed."
        cancelLabel="Keep items" confirmLabel="Clear checked" onConfirm={() => changeList('clear checked items', () => clearCheckedItems(monday, checked.map(({ id }) => id), week.generationId))} />

      {fallback && <OrganizerDialog title="Copy grocery list" subtitle="Select the text and copy it from your device." onClose={() => setFallback('')}
        footer={<button className="button dark-button" type="button" onClick={() => { copyField.current?.focus(); copyField.current?.select() }}>Select text</button>}>
        <textarea className="grocery-copy-field" ref={copyField} aria-label="Remaining grocery items" value={fallback} readOnly rows={12} />
      </OrganizerDialog>}
    </section>
  )
}

export function Groceries({ library }: { library: ReadyLibrary }) {
  const [params, setParams] = useSearchParams()
  const today = localDateKey()
  const requested = params.get('date') ?? ''
  const date = isPlannerDate(requested) ? requested : today
  const view = params.get('view') === 'recipe' ? 'recipe' : 'aisle'

  function changeParam(name: string, value?: string) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (value) updated.set(name, value)
      else updated.delete(name)
      return updated
    }, { replace: true })
  }

  return <GroceryPage key={weekStart(date)} library={library} date={date} view={view}
    onDate={(next) => changeParam('date', next === today ? undefined : next)} onView={(next) => changeParam('view', next === 'recipe' ? next : undefined)} />
}
