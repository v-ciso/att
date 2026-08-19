'use client';

import { useMemo, useState } from 'react';
import { FileSignature, Sparkles } from 'lucide-react';
import { can, type Actor } from '@/lib/permissions';
import { uploadDocument } from '@/lib/docs-client';
import { HR_TEMPLATES, MERGE_FIELDS, mergeTemplate, renderTemplatePdf } from '@/lib/hr-templates';
import { useTheme } from '@/components/white-label/theme-provider';
import type { Person } from './roster';

// Company Forms — generate an offer letter, write-up, award, or promotion
// letter for a specific rep. The merged text is editable before generating,
// the result is a PDF filed on the rep's profile (kind=TEMPLATE, addressed to
// their employeeCode) via the same tenant-isolated upload path as any other
// document. Manager-only: `docs.manage` gates both this UI and the API.

export function FormGenerator({ actor, people }: { actor: Actor | null | undefined; people: Person[] }) {
  const manage = can(actor, 'docs.manage');
  const { theme } = useTheme();
  const [templateId, setTemplateId] = useState(HR_TEMPLATES[0].id);
  const [personId, setPersonId] = useState('');
  const [draft, setDraft] = useState<string | null>(null); // null = follow the template
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Only people with a code can have paperwork filed against them — the code
  // is the stable key documents are addressed to.
  const eligible = useMemo(
    () => people.filter(p => p.employeeCode && (p.status ?? 'active') !== 'archived'),
    [people]
  );
  const person = eligible.find(p => p.id === personId) ?? null;
  const template = HR_TEMPLATES.find(t => t.id === templateId) ?? HR_TEMPLATES[0];

  const merged = person ? mergeTemplate(draft ?? template.body, person, theme.companyName) : (draft ?? template.body);

  if (!manage) return null;

  const generate = async () => {
    if (!person?.employeeCode) return;
    setBusy(true);
    setNotice(null);
    const title = `${template.name} — ${person.name}`;
    try {
      const file = await renderTemplatePdf({ title, mergedBody: merged, companyName: theme.companyName });
      const { doc, error } = await uploadDocument({
        file,
        title,
        kind: 'TEMPLATE',
        audiencePersonIds: [person.employeeCode],
      });
      setNotice(error ?? (doc ? `Filed "${doc.title}" on ${person.name}'s profile — open it from their employee file.` : 'Generation failed.'));
    } catch {
      setNotice('Could not generate the PDF — try again.');
    }
    setBusy(false);
  };

  const selectClass = 'w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary';

  return (
    <section aria-label="Company forms" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted flex items-center gap-2">
        <FileSignature className="w-4 h-4" aria-hidden="true" /> Company Forms
      </h2>
      <p className="text-xs text-text-muted -mt-1">
        Fill a built-in form for a rep and file the PDF straight onto their employee profile.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor="form-template" className="label-base">Form</label>
          <select
            id="form-template"
            value={templateId}
            onChange={e => { setTemplateId(e.target.value); setDraft(null); }}
            className={selectClass}
          >
            {HR_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="form-person" className="label-base">Employee</label>
          <select
            id="form-person"
            value={personId}
            onChange={e => setPersonId(e.target.value)}
            className={selectClass}
          >
            <option value="">Choose an employee…</option>
            {eligible.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.employeeCode})</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="form-body" className="label-base">
          {person ? 'Letter (merged — edit anything before generating)' : 'Template text'}
        </label>
        <textarea
          id="form-body"
          value={merged}
          onChange={e => setDraft(e.target.value)}
          rows={12}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-text-primary leading-relaxed"
        />
        <p className="text-[10px] text-text-muted mt-1">
          Merge fields: {MERGE_FIELDS.join(' ')} — filled from the roster when an employee is chosen.
          {person && !person.email && ' This person has no email on file; add one via Roster → edit.'}
        </p>
      </div>

      {notice && (
        <p role="status" className="text-xs text-text-muted bg-white/5 rounded-lg px-3 py-2">{notice}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
          disabled={!person || busy}
          onClick={() => void generate()}
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? 'Generating…' : person ? `Generate PDF & file on ${person.name.split(' ')[0]}'s profile` : 'Choose an employee first'}
        </button>
      </div>
    </section>
  );
}
