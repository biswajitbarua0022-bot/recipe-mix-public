import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, ChevronLeft, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { OrganizerDialog } from '../components/OrganizerDialog'
import { readBackupData, replaceBackupData } from '../data/backup-store'
import type { BackupData } from '../data/backup-store'
import { visibleItems } from '../groceries/grocery-list'
import type { OfflineApp } from '../pwa/use-offline-app'
import { downloadBackup, prepareRestore } from './backup-files'
import { InstallGuide } from './InstallGuide'
import './settings.css'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function counts(data: BackupData) {
  return {
    Recipes: data.recipes.length,
    Photos: data.recipePhotos.length,
    Cookbooks: data.cookbooks.length,
    'Planned meals': data.mealSlots.length,
    'Grocery items': data.groceryWeeks.reduce((total, week) => total + visibleItems(week).length, 0),
  }
}

type Counts = ReturnType<typeof counts>
type Preview = Awaited<ReturnType<typeof prepareRestore>> & { name: string; current: Counts }

export function Settings({ offline, onRestore }: { offline: OfflineApp; onRestore: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<Counts>()
  const [lastExport, setLastExport] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [exportedFirst, setExportedFirst] = useState(false)
  const [restored, setRestored] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let active = true
    void readBackupData().then(({ data, lastExport }) => {
      if (active) {
        setSummary(counts(data))
        setLastExport(lastExport)
      }
    }).catch(() => {
      if (active) setError('Could not read what’s saved on this device. Check that this browser allows local storage.')
    })
    return () => { active = false }
  }, [])

  async function exportData() {
    setBusy(true)
    setError('')
    setReviewError('')
    setNotice('')
    try {
      const time = await downloadBackup()
      setLastExport(time)
      if (preview) setExportedFirst(true)
      else setNotice('Backup download started.')
    } catch {
      const message = 'Could not export your backup. Check that this browser allows local storage and downloads.'
      if (preview) setReviewError(message)
      else setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function reviewFile(file: File) {
    setBusy(true)
    setError('')
    setNotice('')
    setReviewError('')
    setRestored(false)
    setExportedFirst(false)
    try {
      const backup = await prepareRestore(file)
      const { data } = await readBackupData()
      setPreview({ ...backup, name: file.name, current: counts(data) })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not read the backup file.')
    } finally {
      setBusy(false)
    }
  }

  async function replaceData() {
    if (!preview) return
    setBusy(true)
    setReviewError('')
    try {
      await replaceBackupData(preview.data)
      setSummary(counts(preview.data))
      setPreview(null)
      setRestored(true)
      onRestore()
      window.scrollTo(0, 0)
    } catch (failure) {
      setReviewError(failure instanceof DOMException && failure.name === 'QuotaExceededError'
        ? 'This browser is out of storage space. Your existing data is safe.'
        : 'Could not restore the backup. Your existing data is safe.')
    } finally {
      setBusy(false)
    }
  }

  const incoming = preview ? counts(preview.data) : null
  return (
    <section className="settings-page">
      <Link className="back-link settings-back" to="/recipes"><ChevronLeft size={17} aria-hidden="true" /> Recipe Box</Link>
      <header className="settings-heading">
        <h1>Settings</h1>
        <p>Recipe Mix 1.0{!offline.online && ' · Offline'}</p>
      </header>
      {offline.hasUpdate && <div className="settings-banner settings-warning">
        <p><strong>An app update is ready.</strong> Reload to use the latest version.</p>
        <button type="button" className="button" disabled={busy || Boolean(preview)} onClick={offline.applyUpdate}>Reload to update</button>
      </div>}
      {restored && <div className="settings-banner settings-success" role="status">
        <CircleCheck size={18} aria-hidden="true" />
        <div><strong>Backup restored</strong><p>Your recipes, cookbooks, plans and grocery lists are ready to use.</p><Link to="/recipes">Open Recipe Box</Link></div>
      </div>}
      <section className="settings-panel" aria-labelledby="device-title">
        <h2 id="device-title">On this device</h2>
        <p>Your recipes, plans and lists are saved in this browser on this device. If you clear browser data or switch devices, you can bring them with you by exporting a backup.</p>
        <dl className="settings-counts">
          {(['Recipes', 'Cookbooks', 'Planned meals', 'Grocery items'] as const).map((label) => (
            <div key={label}><dt>{label}</dt><dd>{summary?.[label] ?? '–'}</dd></div>
          ))}
        </dl>
        <p className={lastExport ? 'last-export has-export' : 'last-export'}>
          {lastExport ? <CircleCheck size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}
          {lastExport ? `Last export ${dateTime.format(lastExport)}` : 'No backup exported on this device yet'}
        </p>
      </section>
      <section className="settings-panel" aria-labelledby="backup-title">
        <h2 id="backup-title">Backup</h2>
        <div className="settings-backup-actions">
          <button className="button" type="button" disabled={busy} onClick={() => { void exportData() }}>
            <ArrowDownToLine size={21} aria-hidden="true" /><span><strong>Export backup</strong><small>Saves your data as a .json file</small></span>
          </button>
          <button className="button" type="button" disabled={busy} onClick={() => input.current?.click()}>
            <ArrowUpToLine size={21} aria-hidden="true" /><span><strong>Restore backup</strong><small>Review the file before replacing anything</small></span>
          </button>
        </div>
        <input hidden ref={input} type="file" accept=".json,application/json" aria-label="Backup file" onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void reviewFile(file)
        }} />
        {busy && !preview && <p className="settings-inline-status" role="status">Preparing backup…</p>}
        {notice && <p className="settings-inline-status has-export" role="status">{notice}</p>}
        {error && <div className="settings-banner settings-warning" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <div><strong>Could not open the backup</strong><p>{error}</p>
            <button className="text-button" type="button" disabled={busy} onClick={() => input.current?.click()}>Choose another file</button>
          </div>
        </div>}
      </section>
      <InstallGuide offline={offline} />
      {preview && incoming && <OrganizerDialog title="Review backup" subtitle={preview.name} busy={busy} onClose={() => setPreview(null)} footer={<>
        <button className="button" type="button" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
        <button className="button primary-button" type="button" disabled={busy} onClick={() => { void replaceData() }}>Replace with backup</button>
      </>}>
        <p className="backup-date">Exported {dateTime.format(new Date(preview.exportedAt))}</p>
        <table className="backup-comparison">
          <thead><tr><td /><th scope="col">In backup</th><th scope="col">On this device now</th></tr></thead>
          <tbody>{(Object.keys(incoming) as (keyof Counts)[]).map((label) => (
            <tr key={label}><th scope="row">{label}</th><td>{incoming[label]}</td><td>{preview.current[label]}</td></tr>
          ))}</tbody>
        </table>
        <div className="settings-banner settings-warning"><TriangleAlert size={18} aria-hidden="true" />
          <p><strong>Restoring replaces everything on this device.</strong> The file becomes your recipe library, meal plan and grocery history.</p>
        </div>
        <div className="backup-export-first">
          {exportedFirst ? <p className="has-export" role="status"><CircleCheck size={16} aria-hidden="true" /> Current backup download started.</p> : <>
            <p>Keep a copy of what’s on this device before replacing it.</p>
            <button className="button" type="button" disabled={busy} onClick={() => { void exportData() }}>
              <ArrowDownToLine size={16} aria-hidden="true" /> Export current data first
            </button>
          </>}
        </div>
        {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
      </OrganizerDialog>}
    </section>
  )
}
