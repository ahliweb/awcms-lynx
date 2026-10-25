# UI, accessibility and responsive guidelines

Rules for screens in `packages/app`. They hold on every host, because the same components render natively and on the Web.

## Elements

Lynx is not a browser. Use lowercase Lynx elements — `<view>`, `<text>`, `<image>`, `<scroll-view>`, `<input>` — never `div`/`span`/`button`. Text renders only inside `<text>`. `display` is set explicitly (`flex`) in every layout class. A Lynx `<input>` is uncontrolled: read its value from `bindinput` (`event.detail.value`).

## Components (`packages/app/src/components`)

| Component | Use | Accessibility built in |
| --- | --- | --- |
| `Screen`, `Section`, `Row`, `Loading` | page scaffold, labelled rows | heading flags on titles; each row is one element read as "label: value" |
| `Button` | every tappable action | `accessibility-element`, `traits="button"`, label = visible text; 48 px minimum target; disabled and busy states |
| `TextField` | labelled single-line input | visible label, `accessibility-label`, error text announced as its own element |
| `Notice` | info / success / warning / error message | one element with the full sentence as label |
| `TabBar` | top-level navigation | each tab is a button; the active one carries `selected` |

## Design tokens (`packages/app/src/styles/app.css`)

Declared as custom properties on `.App`. Contrast (WCAG 2.2 AA, ≥ 4.5:1 for text):

| Pair | Ratio |
| --- | --- |
| `--color-text` #1b1f24 on `--color-surface` #ffffff | 16.6 : 1 |
| `--color-muted` #4a5360 on #ffffff | 7.8 : 1 |
| `--color-muted` on `--color-bg` #f6f7f9 | 7.3 : 1 |
| `--color-on-primary` #ffffff on `--color-primary` #0b5cad | 6.7 : 1 |
| `--color-primary` on #ffffff (secondary buttons, prices) | 6.7 : 1 |
| #ffffff on `--color-danger` #b42318 (and the danger colour as error text on #ffffff) | 6.6 : 1 |
| `--color-text` on notice backgrounds (#e8f1fb, #fdecea, #e7f6ec, #fff4e0) | ≥ 14 : 1 |

A derived product re-brands by changing the tokens, `PUBLIC_AWCMS_APP_NAME`, and the host icons (`apps/desktop/resources/`, the native host's launcher icons) — and re-checks these ratios.

## Accessibility checklist (per screen)

- Every interactive element is a `Button`/`TabBar` tab or carries `accessibility-element` + a trait + a label.
- Every input has a visible label; errors are text, not colour alone.
- Headings use `accessibility-heading`.
- Images carry `accessibility-label` (the API's `alt`, else the item name).
- Status changes (loading, error, success) appear as text in a `Notice` or `Loading`.
- Touch targets ≥ 48 × 48.
- Test with VoiceOver (iOS), TalkBack (Android), the HarmonyOS screen reader, and a browser screen reader on the Web host; record results in the product's PoC (ADR-0146 §2.7).

## Responsive layout

The layout is a single column that stretches: flex columns, percentage widths, no fixed page width. Phones and tablets render the same tree; on the Web and desktop the host decides the viewport (the web page sets `width=device-width`, the desktop window has a minimum size). A product that needs a two-pane tablet/desktop layout branches on `SystemInfo.pixelWidth / pixelRatio` inside the screen, not per host.

## Language

Strings live in `packages/app/src/i18n.ts`; Indonesian is the default and English the fallback. A new string is added to both tables in the same change (the `id` table is typed `Record<MessageKey, string>`, so a missing translation fails `tsc`). Dates use `formatDateTime()` and money `formatMoney()` — both without `Intl`, which the Lynx background thread lacks.

## UX rules

- Never claim more than the server said: the OTP request screen says a code is on its way *if* an account exists, because the backend answers neutrally.
- Errors are one actionable sentence from `describeError()`; raw server messages are never shown.
- Signing out always succeeds locally, even offline.
- The Settings screen tells the truth about where the session is stored.
