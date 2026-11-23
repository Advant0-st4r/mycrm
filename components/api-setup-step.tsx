import { Callout, StepCard } from './step-card'

const LINK = 'text-sky-400 underline underline-offset-2 hover:text-sky-300'

export function ApiSetupStep() {
  return (
    <StepCard step={1} title="Connect Google Maps">
      <Callout>
        Turn on <strong>Places API (New)</strong> and <strong>Geocoding API</strong> in one Google Cloud project so this app can find places and nearby addresses.
      </Callout>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300 marker:text-sky-400">
        <li>
          Open the{' '}
          <a className={LINK} href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
            Google Cloud Console
          </a>{' '}
          and choose a project with billing turned on (or create one).
        </li>
        <li>
          In the{' '}
          <a className={LINK} href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer">
            Services
          </a>
          , turn on <strong className="text-slate-100">Places API (New)</strong> and{' '}
          <strong className="text-slate-100">Geocoding API</strong>.
        </li>
        <li>
          Go to{' '}
          <a className={LINK} href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Credentials
          </a>
          ,           create a key and limit it to these two services.
        </li>
        <li>For extra safety, limit the key to this website.</li>
      </ol>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="mb-2 font-semibold text-amber-300">Approximate cost to look up 5,000 places</p>
        <ul className="space-y-1 text-xs">
          <li>Place information · about $25 per 1,000</li>
          <li>Address lookups · about $5 per 1,000</li>
          <li>Place searches · about $32 per 1,000</li>
        </ul>
        <p className="mt-3 font-semibold">
          {'≈ ~$160 USD (≈580 QAR)'}
        </p>
      </div>
    </StepCard>
  )
}
