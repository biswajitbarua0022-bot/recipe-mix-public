import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Fragment, useId } from 'react'
import type { MealSlot } from '../data/organizer'
import { plannerMeals } from '../data/organizer'
import { addDays, formatDay, formatWeek, formatWeekday, isPlannerDate, localDateKey, weekDates, weekStart } from './calendar'

export function WeekBar({ date, onSelect, clearWeek, hasMeals, disabled }: { date: string; onSelect: (date: string) => void; clearWeek?: () => void; hasMeals?: boolean; disabled?: boolean }) {
  const today = localDateKey()
  const thisWeek = weekStart(date) === weekStart(today)
  const previous = addDays(date, -7)
  const next = addDays(date, 7)
  return (
    <div className="week-bar organizer-controls">
      <button className="icon-button" type="button" aria-label="Previous week" disabled={disabled || !isPlannerDate(previous)} onClick={() => onSelect(previous)}><ChevronLeft size={19} aria-hidden="true" /></button>
      <div className="week-range"><strong>{formatWeek(date)}</strong>{thisWeek && <span>This week</span>}</div>
      <button className="icon-button" type="button" aria-label="Next week" disabled={disabled || !isPlannerDate(next)} onClick={() => onSelect(next)}><ChevronRight size={19} aria-hidden="true" /></button>
      <button className="button today-button" type="button" disabled={disabled || date === today} onClick={() => onSelect(today)}>Today</button>
      {clearWeek && <button className="text-button clear-week" type="button" aria-label="Clear week" disabled={!hasMeals} onClick={clearWeek}><Trash2 size={17} aria-hidden="true" /><span>Clear week</span></button>}
    </div>
  )
}

export function DayPicker({ date, slots, onSelect, disabled }: { date: string; slots: MealSlot[]; onSelect: (date: string) => void; disabled?: boolean }) {
  const pickerId = useId()
  const today = localDateKey()
  return (
    <div className="day-picker" role="group" aria-label="Choose a day">
      {weekDates(date).map((day) => {
        const meals = slots.filter((slot) => slot.date === day)
        const currentDay = day === today
        const description = `${pickerId}-${day}`
        return <Fragment key={day}>
          <button className={`day-choice${currentDay ? ' today' : ''}`} type="button" disabled={disabled} aria-pressed={day === date} aria-current={currentDay ? 'date' : undefined} aria-describedby={description} onClick={() => onSelect(day)}>
            {currentDay && <span className="day-choice-today" aria-hidden="true">Today</span>}
            <span>{formatWeekday(day)}</span><strong>{Number(day.slice(-2))}</strong>
            <span className="meal-dots" aria-hidden="true">{plannerMeals.map((meal) => <i key={meal} className={meals.some((slot) => slot.meal === meal) ? 'filled' : ''} />)}</span>
          </button>
          <span id={description} hidden>{formatDay(day)}, {meals.length} planned</span>
        </Fragment>
      })}
    </div>
  )
}
