import { Callout, StepCard } from './step-card'

const LINK = 'text-sky-400 underline underline-offset-2 hover:text-sky-300'

export function ApiSetupStep() {
  return (
    <StepCard step={1} title="Enable the required Google APIs">
      <Callout>
        You need <strong>TWO</strong> APIs on the same Google Cloud project:{' '}
        <strong>Places API (New)</strong> and <strong>Geocoding API</strong>.
      </Callout>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300 marker:text-sky-400">
        <li>
          Open the{' '}
          <a className={LINK} href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
            Google Cloud Console
          </a>{' '}
          and select (or create) a project with billing enabled.
        </li>
        <li>
          In the{' '}
          <a className={LINK} href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer">
            API Library
          </a>
          , enable <strong className="text-slate-100">Places API (New)</strong> and{' '}
          <strong className="text-slate-100">Geocoding API</strong>.
        </li>
        <li>
          Go to{' '}
          <a className={LINK} href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Credentials
          </a>
          , create an API key, and add both APIs to the key&apos;s <em>API restrictions</em>.
        </li>
        <li>Optionally restrict the key to this site&apos;s HTTP referrer.</li>
      </ol>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="mb-2 font-semibold text-amber-300">Estimated cost for ~5,000 places</p>
        <ul className="space-y-1 font-mono text-xs">
          <li>Place Details (Enterprise + Atmosphere) · ~$25 / 1k</li>
          <li>Geocoding · ~$5 / 1k</li>
          <li>Text Search · ~$32 / 1k</li>
        </ul>
        <p className="mt-3 font-semibold">
          {'≈ ~$160 USD (≈580 QAR)'}
        </p>
      </div>
    </StepCard>
  )
}
