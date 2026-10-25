/**
 * Money display without `Intl` (the Lynx runtime does not ship it).
 *
 * The backend sends money as a `numeric(14,2)` decimal STRING such as
 * "19999.00". It is never converted to a JS number: that would round-trip
 * through a double and, worse, tempt callers into float arithmetic on prices.
 * Formatting here is pure string manipulation on the digits.
 *
 *   id  Rp19.999      Rp19.999,50     (dot thousands, comma decimals)
 *   en  IDR 19,999    IDR 19,999.50
 *
 * Cents are shown only when non-zero, matching the Indonesian storefront.
 * Input that is not a plain decimal is returned unchanged so a surprising
 * backend value is visible instead of silently becoming "NaN".
 */

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

export function formatMoney(amount: string, locale: 'en' | 'id', currency = 'IDR'): string {
  if (typeof amount !== 'string') return amount;
  const match = DECIMAL_PATTERN.exec(amount);
  if (!match) return amount;

  const negative = match[1] === '-';
  const whole = (match[2] ?? '0').replace(/^0+(?=\d)/, '');
  let fraction = (match[3] ?? '').padEnd(2, '0');
  const hasCents = /[1-9]/.test(fraction);
  // Trim padding beyond two digits only ("19999.500" -> ",50"); no lookbehind, PrimJS may lack it.
  while (fraction.length > 2 && fraction.endsWith('0')) fraction = fraction.slice(0, -1);

  const groupSeparator = locale === 'id' ? '.' : ',';
  const decimalSeparator = locale === 'id' ? ',' : '.';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  const number = hasCents ? `${grouped}${decimalSeparator}${fraction}` : grouped;

  const isZero = !hasCents && /^0+$/.test(whole);
  const sign = negative && !isZero ? '-' : '';
  const prefix = locale === 'id' && currency === 'IDR' ? 'Rp' : `${currency} `;
  return `${sign}${prefix}${number}`;
}
