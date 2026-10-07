'use client';

import { RETAILERS, SOW_EFFECTIVE_DATE, type PayoutDetails } from '@/lib/sow-payout';

export type SOWOptions = Pick<PayoutDetails, 'retailer' | 'newLineTier' | 'upgradeTier' | 'byod' | 'autoBillPay' | 'ecEligible' | 'protectionFour' | 'voipPort'>;
const inputClass = 'min-h-11 rounded-lg border border-border-subtle bg-bg-tertiary px-3 text-sm text-text-primary';
export function SOWFields({ value, onChange }: { value: SOWOptions; onChange: (value: SOWOptions) => void }) {
  return <fieldset className="flex basis-full flex-wrap gap-3 rounded-xl border border-border-subtle p-3 text-text-primary">
    <legend className="px-2 text-sm font-semibold">Office payout eligibility · SOW {SOW_EFFECTIVE_DATE}</legend>
    <p className="basis-full text-sm leading-6 text-text-secondary">Estimates, not rep pay or a confirmed deposit. New lines default to tier 3 and upgrades to tier 2 until you select the company’s assigned tier. Unknown EC is excluded; unknown autopay uses the no-autopay rate. Upgrade-plan and converged supplements are not specified in this SOW and are excluded.</p>
    <label className="flex flex-col gap-1 text-sm">Retailer<select className={inputClass} value={value.retailer ?? ''} onChange={e => onChange({ ...value, retailer: e.target.value ? e.target.value as SOWOptions['retailer'] : undefined })}><option value="">Detect from store name</option>{RETAILERS.map(retailer => <option key={retailer}>{retailer}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm">New-line tier<select className={inputClass} value={value.newLineTier ?? ''} onChange={e => onChange({ ...value, newLineTier: e.target.value ? Number(e.target.value) : undefined })}><option value="">Unknown · estimate tier 3</option>{[1, 2, 3, 4, 5].map(tier => <option key={tier} value={tier}>Tier {tier}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm">Upgrade tier<select className={inputClass} value={value.upgradeTier ?? ''} onChange={e => onChange({ ...value, upgradeTier: e.target.value ? Number(e.target.value) : undefined })}><option value="">Unknown · estimate tier 2</option><option value="1">Tier 1</option><option value="2">Tier 2</option></select></label>
    {([['autoBillPay', 'Internet autopay'], ['ecEligible', 'EC criteria met']] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-1 text-sm">{label}<select className={inputClass} value={value[key] === undefined ? '' : String(value[key])} onChange={e => onChange({ ...value, [key]: e.target.value === '' ? undefined : e.target.value === 'true' })}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
    <label className="flex flex-col gap-1 text-sm">Protect Advantage 4<input className={inputClass} type="number" min={0} max={99} value={value.protectionFour ?? 0} onChange={e => onChange({ ...value, protectionFour: Math.max(0, Number.parseInt(e.target.value) || 0) })} /></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!value.byod} onChange={e => onChange({ ...value, byod: e.target.checked })} />BYOD / non-smartphone</label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!value.voipPort} onChange={e => onChange({ ...value, voipPort: e.target.checked })} />VoIP port (not payable)</label>
  </fieldset>;
}
