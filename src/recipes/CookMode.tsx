import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ShoppingBasket, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import mark from '../assets/mark.svg'
import { IngredientList } from './IngredientList'
import type { RecipeWithPhoto } from './recipe'
import { RecipeArt } from './RecipeArt'
import { scaleIngredients } from './scale-ingredients'
import { useScreenWakeLock } from './use-screen-wake-lock'
import './cook-mode.css'

export function CookMode({ recipe, servings }: { recipe: RecipeWithPhoto; servings: number }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [peekOpen, setPeekOpen] = useState(false)
  const [finished, setFinished] = useState(false)
  const instruction = useRef<HTMLDivElement>(null)
  const finishTitle = useRef<HTMLHeadingElement>(null)
  const peekToggle = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const stepCount = recipe.steps.length
  const active = useScreenWakeLock(stepCount > 0 && !finished)
  const lastStep = stepIndex === stepCount - 1
  const backTo = `/recipes/${recipe.id}?servings=${servings}`
  const servingLabel = `${servings} ${servings === 1 ? 'serving' : 'servings'}`

  useLayoutEffect(() => {
    if (finished) finishTitle.current?.focus()
    else if (instruction.current) instruction.current.scrollTop = 0
  }, [stepIndex, finished])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (peekOpen) {
          setPeekOpen(false)
          peekToggle.current?.focus()
        } else {
          navigate(backTo, { replace: true })
        }
        return
      }
      if (finished || stepCount === 0) return
      if (event.key.toLowerCase() === 'i' && (event.target === instruction.current || event.target === peekToggle.current)) {
        event.preventDefault()
        setPeekOpen((open) => !open)
        peekToggle.current?.focus()
      } else if (!peekOpen && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        setStepIndex((index) => Math.max(0, Math.min(index + direction, stepCount - 1)))
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [backTo, finished, navigate, peekOpen, stepCount])

  return (
    <section className="cook-mode" aria-label="Cook Mode">
      <header className="cook-header">
        <div className="cook-bar">
          <Link className="button cook-exit" to={backTo} replace><X size={18} aria-hidden="true" /> Exit</Link>
          <h1 className="cook-name">{recipe.title}</h1>
          <p className={`wake-status${active ? ' awake' : ''}`} role="status">{active ? 'Screen stays on' : 'Screen may dim'}</p>
        </div>
        {stepCount > 0 && !finished && <div className="cook-progress">
          <strong>Step {stepIndex + 1} of {stepCount}</strong>
          {stepCount <= 12 ? <div className="progress-segments" aria-hidden="true">
            {recipe.steps.map((_, index) => <span key={index} className={index < stepIndex ? 'complete' : index === stepIndex ? 'current' : undefined} />)}
          </div> : <progress value={stepIndex + 1} max={stepCount} aria-hidden="true" />}
        </div>}
      </header>

      {finished ? (
        <div className="cook-finished">
          {recipe.motif ? <RecipeArt motif={recipe.motif} /> : <img src={mark} alt="" width="100" height="100" />}
          <h2 ref={finishTitle} tabIndex={-1}>{recipe.title} is ready</h2>
          <p>{servingLabel}</p>
          <div className="cook-finish-actions">
            <Link className="button primary-button" to={backTo} replace>Back to recipe</Link>
            <button className="button" type="button" onClick={() => {
              setStepIndex(0)
              setFinished(false)
              requestAnimationFrame(() => instruction.current?.focus())
            }}>Cook again from step 1</button>
          </div>
        </div>
      ) : stepCount === 0 ? (
        <div className="cook-finished"><h2>This recipe has no steps yet</h2><Link className="button primary-button" to={`/recipes/${recipe.id}/edit`}>Edit recipe</Link></div>
      ) : <>
        <div className="cook-instruction-scroll" ref={instruction} tabIndex={0} aria-label="Current instruction">
          <article className="cook-width cook-instruction" aria-live="polite" aria-atomic="true">
            <h2 className="detail-eyebrow">Step {stepIndex + 1}</h2>
            <p>{recipe.steps[stepIndex]}</p>
          </article>
        </div>

        <footer className="cook-controls">
          <div className="cook-width cook-control-inner">
            <button ref={peekToggle} className="button cook-peek-toggle" type="button" aria-controls="cook-ingredients" aria-expanded={peekOpen} onClick={() => setPeekOpen((open) => !open)}>
              <ShoppingBasket size={17} aria-hidden="true" /> {peekOpen ? 'Hide ingredients' : 'Ingredients'} · {servingLabel} {peekOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>
            <section className="cook-peek" id="cook-ingredients" aria-labelledby="peek-heading" hidden={!peekOpen} tabIndex={0}>
              <div className="cook-peek-header">
                <h2 id="peek-heading">Ingredients · {servingLabel}</h2>
                <button className="icon-button" type="button" aria-label="Close ingredients" onClick={() => {
                  setPeekOpen(false)
                  peekToggle.current?.focus()
                }}><X size={18} aria-hidden="true" /></button>
              </div>
              {peekOpen && <IngredientList ingredients={scaleIngredients(recipe, servings)} />}
            </section>
            <div className="cook-step-actions">
              <button className="button" type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={22} aria-hidden="true" /> Previous</button>
              <button className="button primary-button" type="button" onClick={() => {
                if (lastStep) {
                  setPeekOpen(false)
                  setFinished(true)
                } else {
                  setStepIndex((index) => Math.min(stepCount - 1, index + 1))
                }
              }}>{lastStep ? <>Finish cooking <Check size={21} aria-hidden="true" /></> : <>Next step <ChevronRight size={22} aria-hidden="true" /></>}</button>
            </div>
            <p className="cook-keyboard">Keyboard · ← → to move · Esc to close ingredients or exit</p>
          </div>
        </footer>
      </>}
    </section>
  )
}
