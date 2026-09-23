export interface SelectableDDReport {
  ddWeek: string;
  reportType: string;
  isAuthoritative: boolean;
  status: string;
  createdAt?: string;
}

export function selectDDReport<T extends SelectableDDReport>(batches: T[], week = ''): T | undefined {
  return batches.filter(batch => batch.reportType === 'DD_BY_REP' &&
    (batch.isAuthoritative || batch.status === 'PARTIAL') &&
    (!week || batch.ddWeek.slice(0, 10) === week))
    .sort((a, b) => b.ddWeek.localeCompare(a.ddWeek) ||
      Number(b.isAuthoritative) - Number(a.isAuthoritative) ||
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
}

export function canRestoreDDReport(batch: { status: string; confirmedAt: unknown }) {
  return Boolean(batch.confirmedAt) && ['CONFIRMED', 'SUPERSEDED', 'ROLLED_BACK'].includes(batch.status);
}

export function hasIncompleteRepTotal(warnings: string[], externalRepId: string) {
  return warnings.some(warning => warning.startsWith(`Carrier ${externalRepId}:`) && warning.includes('rep total is missing'));
}
