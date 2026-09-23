import { parseMoney, parsePromoRows } from './promo-parse';

// The parser feeds commission rules, so the bar is "never invent a number".
// These tests focus on what it must REFUSE as much as what it accepts.

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}

// --- parseMoney -------------------------------------------------------------
check('plain number', parseMoney('250') === 250);
check('dollar sign', parseMoney('$250') === 250);
check('thousands separator', parseMoney('$1,000.00') === 1000);
check('decimals kept', parseMoney('12.50') === 12.5);
check('parenthesised negative', parseMoney('($50)') === -50);
check('leading minus', parseMoney('-25') === -25);
check('USD suffix', parseMoney('100USD') === 100);
check('rejects empty', parseMoney('') === null);
check('rejects bare dollar', parseMoney('$') === null);
check('rejects text', parseMoney('iPhone 15 Pro') === null);
check('rejects mixed text+number', parseMoney('iPhone 15') === null);
check('rejects a dash', parseMoney('-') === null);
check('zero parses', parseMoney('0') === 0);

// --- parsePromoRows: happy path --------------------------------------------
const basic = parsePromoRows([
  ['iPhone 15 Pro', '$1,000'],
  ['Galaxy S24', '$800'],
]);
check('extracts both promo rows', basic.length === 2);
check('label preserved', basic[0].label === 'iPhone 15 Pro');
check('amount parsed', basic[0].amount === 1000);
check('source line retained for review', basic[0].source.includes('iPhone 15 Pro'));

// --- ambiguity is refused, not guessed -------------------------------------
const multiMoney = parsePromoRows([['iPhone 15', '$800', '$1,000', '$1,200']]);
check('row with several money columns is skipped', multiMoney.length === 0);

const noMoney = parsePromoRows([['iPhone 15 Pro', 'see rep portal']]);
check('row with no amount is skipped', noMoney.length === 0);

const zeroAmount = parsePromoRows([['Accessory bundle', '$0']]);
check('zero-dollar promo is skipped', zeroAmount.length === 0);

const negative = parsePromoRows([['Restocking fee', '($35)']]);
check('negative amount is skipped', negative.length === 0);

// --- noise rejection --------------------------------------------------------
check('total row rejected', parsePromoRows([['Total', '$5,000']]).length === 0);
check('subtotal row rejected', parsePromoRows([['Subtotal', '$5,000']]).length === 0);
check('effective-date row rejected', parsePromoRows([['Effective 07/01', '$100']]).length === 0);
check('page footer rejected', parsePromoRows([['Page 2', '$100']]).length === 0);
check('numeric-only label rejected', parsePromoRows([['2026', '$100']]).length === 0);
check('too-short label rejected', parsePromoRows([['A', '$100']]).length === 0);
check('single-cell row rejected', parsePromoRows([['$100']]).length === 0);
check('empty grid is safe', parsePromoRows([]).length === 0);

// --- de-duplication ---------------------------------------------------------
const dupes = parsePromoRows([
  ['iPhone 15 Pro', '$1,000'],
  ['iPhone 15 Pro', '$1,000'],
  ['iPhone 15 Pro', '$800'],
]);
check('identical rows de-duped', dupes.filter(p => p.amount === 1000).length === 1);
check('same label at a different amount kept', dupes.length === 2);

// --- real-world shapes ------------------------------------------------------
const messy = parsePromoRows([
  ['Device', 'Credit'],                       // header
  ['iPhone 15 Pro Max', '256GB', '$1,000'],   // label split across cells
  ['', '', ''],                               // blank
  ['Pixel 8', '$700'],
  ['Total', '$1,700'],                        // footer
]);
check('header row rejected', !messy.some(p => /^Device/i.test(p.label)));
check('split label is joined', messy.some(p => p.label === 'iPhone 15 Pro Max 256GB' && p.amount === 1000));
check('blank row ignored', messy.every(p => p.label.trim().length > 0));
check('footer total rejected', !messy.some(p => p.amount === 1700));
check('messy sheet yields exactly the real promos', messy.length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
