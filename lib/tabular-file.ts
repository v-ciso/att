const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 200;

function bounded(rows: unknown[][]): string[][] {
  if (rows.length > MAX_ROWS) throw new Error('The file has too many rows. The limit is 10,000.');
  return rows.map((row) => {
    if (row.length > MAX_COLUMNS) throw new Error('The file has too many columns. The limit is 200.');
    return row.map((cell) => String(cell ?? ''));
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((value) => value.trim())) rows.push(row);
      if (rows.length > MAX_ROWS) throw new Error('The file has too many rows. The limit is 10,000.');
      row = [];
      cell = '';
    } else cell += char;
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted value.');
  row.push(cell.replace(/\r$/, ''));
  if (row.some((value) => value.trim())) rows.push(row);
  return bounded(rows);
}

export async function readTabularFile(file: File, allSheets = false): Promise<string[][]> {
  if (file.size > MAX_FILE_BYTES) throw new Error('The file is larger than the 10 MB limit.');

  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (isCsv) return parseCsv(await file.text());

  if (!/\.xlsx$/i.test(file.name) && file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    throw new Error('Supported spreadsheet formats are XLSX and CSV.');
  }

  const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
  const sheets = allSheets ? await readSheetNames(file) : [1];
  const rows: unknown[][] = [];
  for (const sheet of sheets) {
    const sheetRows = await readXlsxFile(file, { sheet });
    rows.push(...sheetRows);
    if (rows.length > MAX_ROWS) throw new Error('The file has too many rows. The limit is 10,000.');
  }
  return bounded(rows);
}
