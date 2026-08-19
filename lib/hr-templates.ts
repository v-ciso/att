'use client';

// Built-in company form templates: offer letters, write-ups, awards,
// promotions. Merged with a person's roster record and rendered to PDF
// client-side (jspdf, dynamically imported — it only loads when someone
// actually generates a form), then uploaded through the normal /api/docs
// path with kind=TEMPLATE and audiencePersonIds=[employeeCode], which is
// what files it on that person's profile page.
//
// Templates are per-company text: the built-ins below are starting points the
// manager can edit in the compose box before generating. The generated PDF is
// stored on the company's own tenant-isolated shelf (lib/docs.ts invariant 1),
// so one company's letters can never surface in another company's library.

import type { Person } from '@/components/dashboard/roster';

export interface HrTemplate {
  id: string;
  name: string;
  /** Which drawer of the filing cabinet this belongs to, for labels only. */
  category: 'Hiring' | 'Discipline' | 'Recognition' | 'Career';
  body: string;
}

// Merge fields the compose box supports. Kept deliberately small and
// spelled out in the UI: a template author should never have to guess.
export const MERGE_FIELDS = [
  '{{name}}', '{{role}}', '{{email}}', '{{store}}', '{{team}}',
  '{{hire_date}}', '{{today}}', '{{company}}',
] as const;

export const HR_TEMPLATES: HrTemplate[] = [
  {
    id: 'offer-letter',
    name: 'Offer Letter',
    category: 'Hiring',
    body: `{{today}}

Dear {{name}},

We are pleased to offer you the position of {{role}} at {{company}}, based at {{store}}.

Your compensation is commission-based per the current Commission Engine rates, with any guaranteed hourly floor as agreed. Your anticipated start date is {{hire_date}}.

This offer is contingent on completing onboarding requirements. Please confirm your acceptance by replying to this letter.

We are excited to have you on the team.

Sincerely,
{{company}} Management`,
  },
  {
    id: 'write-up',
    name: 'Written Warning',
    category: 'Discipline',
    body: `{{today}}

EMPLOYEE: {{name}} ({{role}}, {{store}})

This is a formal written warning regarding the following conduct or performance issue:

[Describe the issue, with dates and specifics.]

Expected correction:

[Describe what must change and by when.]

Further occurrences may result in additional discipline up to and including separation. This document will be kept on file.

Employee signature: _______________________    Date: ___________
Manager signature:  _______________________    Date: ___________`,
  },
  {
    id: 'award',
    name: 'Award / Recognition',
    category: 'Recognition',
    body: `{{today}}

CERTIFICATE OF RECOGNITION

{{company}} recognizes

{{name}}

for outstanding performance as {{role}} at {{store}}.

[Describe the achievement — competition win, sales milestone, leadership.]

Presented with appreciation,
{{company}} Management`,
  },
  {
    id: 'promotion',
    name: 'Promotion Letter',
    category: 'Career',
    body: `{{today}}

Dear {{name}},

Congratulations! In recognition of your performance at {{store}}, {{company}} is pleased to promote you effective immediately.

Your new role and compensation follow the current Role Structure in the Commission Engine. Your manager will review the details with you.

Thank you for your commitment — we look forward to what you do next.

Sincerely,
{{company}} Management`,
  },
  {
    id: 'timesheet-change',
    name: 'Timesheet / Schedule Change Notice',
    category: 'Career',
    body: `{{today}}

TO: {{name}} ({{role}}, {{store}})

This confirms the following change to your recorded time or schedule:

[Describe the change: date, shift, hours before/after, and reason.]

If you believe this is in error, raise it with your manager within 7 days.

Acknowledged by employee: _______________________    Date: ___________`,
  },
];

function fmtDate(iso?: string): string {
  if (!iso) return '____________';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return Number.isNaN(d.getTime())
    ? '____________'
    : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Fills every merge field from the person's roster record. */
export function mergeTemplate(body: string, person: Person, companyName: string): string {
  const map: Record<string, string> = {
    name: person.name,
    role: person.role,
    email: person.email ?? '____________',
    store: (person.stores ?? []).join(', ') || '____________',
    team: person.team || 'unassigned',
    hire_date: fmtDate(person.hiredAt),
    today: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    company: companyName,
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? `{{${key}}}`);
}

/**
 * Renders merged text to a simple letter-format PDF and returns it as a File
 * ready for uploadDocument. jspdf is imported here, not at module top, so the
 * ~350KB library never loads for people who just read the library.
 */
export async function renderTemplatePdf(input: {
  title: string;
  mergedBody: string;
  companyName: string;
}): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 64;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.companyName, margin, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(input.title, margin, margin + 16);
  doc.setDrawColor(180);
  doc.line(margin, margin + 26, margin + width, margin + 26);

  // Body with page breaks
  doc.setTextColor(20);
  doc.setFontSize(11);
  const lines: string[] = doc.splitTextToSize(input.mergedBody, width);
  let y = margin + 52;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  const blob = doc.output('blob');
  const safe = input.title.replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
  return new File([blob], `${safe || 'document'}.pdf`, { type: 'application/pdf' });
}
