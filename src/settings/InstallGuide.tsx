import { useState } from 'react'
import { CircleCheck, EllipsisVertical, MonitorDown, Plus, Share, Star } from 'lucide-react'
import type { OfflineApp } from '../pwa/use-offline-app'

const platforms = ['iPhone Safari', 'Android Chrome', 'Computer'] as const
type Platform = (typeof platforms)[number]

function currentPlatform(): Platform {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPhone Safari'
  if (/Android/i.test(navigator.userAgent)) return 'Android Chrome'
  return 'Computer'
}

const instructions = {
  'iPhone Safari': [
    { label: <>Open this page in <strong>Safari</strong>.</> },
    { label: <>Tap <strong>Share</strong> in Safari’s toolbar or page menu.</>, Icon: Share },
    { label: <>Choose <strong>Add to Home Screen</strong>, turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</>, Icon: Plus },
  ],
  'Android Chrome': [
    { label: <>Open this page in <strong>Chrome</strong>.</> },
    { label: <>Tap the <strong>More</strong> menu next to the address bar.</>, Icon: EllipsisVertical },
    { label: <>Choose <strong>Install</strong> or <strong>Add to Home screen</strong> and follow Chrome’s prompts.</>, Icon: Plus },
  ],
  Computer: [
    { label: <>In <strong>Chrome or Edge</strong>, look at the right end of the address bar.</> },
    { label: <>Use the <strong>Install</strong> icon or find the install option in the browser menu.</>, Icon: MonitorDown },
    { label: <>In <strong>Safari on Mac</strong>, choose <strong>File → Add to Dock</strong> if available. You can also bookmark the page.</>, Icon: Star },
  ],
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallGuide({ offline }: { offline: OfflineApp }) {
  const device = currentPlatform()
  const [platform, setPlatform] = useState<Platform>(device)
  const installed = isInstalled()

  return (
    <section className="settings-panel" aria-labelledby="install-title">
      <div className="install-heading">
        <img src={`${import.meta.env.BASE_URL}icons/recipe-mix-192.png`} width="60" height="60" alt="" />
        <div>
          <h2 id="install-title">{installed ? 'Recipe Mix is installed' : 'Install Recipe Mix'}</h2>
          <p>{installed ? 'You’re using the installed app.' : 'Add it to your home screen. It opens like an app and works offline after its first online load.'}</p>
        </div>
      </div>
      {!installed && <>
        <div className="install-platforms" role="group" aria-label="Installation device">
          {platforms.map((option) => (
            <button type="button" key={option} aria-pressed={platform === option} onClick={() => setPlatform(option)}>
              {option}{device === option && <small>This device</small>}
            </button>
          ))}
        </div>
        <ol className="install-steps">
          {instructions[platform].map(({ label, Icon }, index) => (
            <li key={index}><span className="install-number" aria-hidden="true">{index + 1}</span><span>{label}</span>
              {Icon && <Icon className="install-step-icon" size={17} aria-hidden="true" />}</li>
          ))}
        </ol>
      </>}
      <p className="install-note">
        {offline.offlineReady ? <><CircleCheck size={14} aria-hidden="true" /> Ready to open offline on this device.</>
          : import.meta.env.DEV ? 'Offline caching is available in the production preview.'
          : 'Keep this page open online until it is ready to use offline.'}
      </p>
    </section>
  )
}
