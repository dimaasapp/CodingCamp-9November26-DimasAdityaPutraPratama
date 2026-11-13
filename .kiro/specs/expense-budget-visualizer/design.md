# Design Document

## Overview

The Expense & Budget Visualizer is a fully client-side, single-page web application delivered as a static HTML file. It has no build step, no server, and no external dependencies beyond a single CDN-loaded Chart.js script. All application state lives in the browser's `localStorage` and is synchronized to the DOM on every mutation.

The application is structured around a **single JavaScript module** (`js/app.js`) that owns the full application lifecycle: storage I/O, state management, DOM rendering, event handling, and chart updates. A **single stylesheet** (`css/style.css`) provides layout, theming (light/dark via a CSS custom-property swap), and responsive breakpoints.

**Key design decisions:**

- **No frameworks** — vanilla DOM APIs keep the bundle trivial and load times fast.
- **Chart.js v4 via CDN** — loaded with a `<script>` tag in `index.html`. The UMD build (`chart.umd.js`) is used so no module bundler is needed. The CDN URL is `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`.
- **Defensive storage reads** — every `localStorage.getItem` is wrapped in a `try/catch` with a known-good fallback so a corrupted value never crashes the app.
- **Event-driven re-render** — after any state mutation the app calls a central `render()` function that synchronises the transaction list, balance display, chart, monthly summary, and category dropdown in one pass. This keeps all views consistent without individual patching logic.
- **CSS custom properties for theming** — the `<html>` element carries a `data-theme` attribute (`"light"` or `"dark"`). All colour tokens are defined as `--var` pairs under `[data-theme="light"]` and `[data-theme="dark"]`, so a single attribute toggle applies the theme globally.

---

## Architecture

The application follows a **single-module MVC-lite pattern**:

```
index.html
├── <link> css/style.css
├── <script> Chart.js CDN (defer)
└── <script> js/app.js (defer)

js/app.js
├── Storage layer   – read/write to localStorage, with fallback defaults
├── State object    – in-memory copy of transactions[], categories[], theme
├── Render layer    – DOM update functions called after every mutation
├── Event layer     – form submit, delete click, category add, theme toggle, nav
└── Chart layer     – Chart.js instance creation and update
```

### Data flow

```
User interaction
      │
      ▼
Event handler (validate input)
      │  valid
      ▼
Mutate state (add/delete transaction / add category / toggle theme)
      │
      ▼
Persist state → localStorage.setItem(...)
      │
      ▼
render()
  ├── renderTransactionList()
  ├── renderBalance()
  ├── renderChart()
  ├── renderMonthlySummary()
  └── renderCategoryDropdown()
```

The chart instance is created once on `DOMContentLoaded` and subsequently updated via `chart.data = …; chart.update()` rather than being destroyed and re-created, which keeps updates within the 100 ms budget.

---

## Components and Interfaces

### 1. Storage Layer (`StorageManager`)

Responsible for all `localStorage` interactions.

```js
// Key constants
const KEYS = {
  TRANSACTIONS: 'evb_transactions',
  CATEGORIES:   'evb_categories',
  THEME:        'evb_theme',
};

// Public interface
StorageManager.load()   // → { transactions, categories, theme }
StorageManager.save(state) // → void
```

`load()` wraps `JSON.parse` in a `try/catch`. On any error it returns the safe default object `{ transactions: [], categories: ['Food', 'Transport', 'Fun'], theme: 'light' }`. `save()` wraps `JSON.stringify` + `setItem` in a `try/catch` and silently ignores `QuotaExceededError` (data integrity is preserved for the existing state; a console warning is emitted).

### 2. State Object

A plain in-memory object that is the single source of truth at runtime:

```js
const state = {
  transactions: [],  // Transaction[]
  categories: [],    // string[]
  theme: 'light',    // 'light' | 'dark'
  activeView: 'main', // 'main' | 'summary'
};
```

### 3. Input Form (`InputForm`)

DOM elements: `#form-add-transaction`, `#input-name`, `#input-amount`, `#select-category`.

Validation rules (enforced by `Validator`):
- Item name: non-empty after trim, length 1–100.
- Amount: parseable as a float, range 0.01–999999999.99, at most 2 decimal places.
- Category: a non-empty selection from the dropdown.

On validation failure, inline `<span class="field-error">` elements are shown adjacent to the offending fields. On success, the form resets and `render()` is called.

### 4. Transaction List (`TransactionList`)

DOM element: `#transaction-list`.

Renders each `Transaction` as a `<li>` row. Each row contains a delete `<button data-id="…">`. Delete is handled via event delegation on the `<ul>` — a single listener on `#transaction-list` checks `event.target.closest('[data-id]')`.

### 5. Balance Display (`BalanceDisplay`)

DOM element: `#balance-total`.

Recomputed on every `render()` call as `transactions.reduce((sum, t) => sum + t.amount, 0)`. Formatted with `toLocaleString('en-US', { style: 'currency', currency: 'USD' })`.

### 6. Chart Engine (`ChartEngine`)

DOM element: `<canvas id="spending-chart">`.

A single `Chart` instance (`type: 'pie'`) is created on load. Labels include the category name and percentage, computed from category totals. The Chart.js built-in tooltip and the `datalabels` label string in `options.plugins.tooltip` provide the "Food 42.3%" format.

Percentage labels are built manually in the `data.labels` array: `${category} ${pct}%` where `pct = (categoryTotal / grandTotal * 100).toFixed(1)`.

When no transactions exist the chart canvas is hidden and a `<p id="chart-empty">` element is shown instead.

### 7. Category Manager (`CategoryManager`)

DOM elements: `#form-add-category`, `#input-category-name`.

Duplicate detection: `state.categories.some(c => c.trim().toLowerCase() === newName.trim().toLowerCase())`.

New categories are appended to `state.categories`, persisted, and `renderCategoryDropdown()` is called immediately.

### 8. Theme Toggle (`ThemeToggle`)

DOM element: `<button id="theme-toggle">` in the top nav.

Toggles `state.theme` between `'light'` and `'dark'`, updates `document.documentElement.setAttribute('data-theme', state.theme)`, persists, and updates the button label/icon. No full re-render is needed.

### 9. Monthly Summary (`MonthlySummary`)

DOM element: `#monthly-summary`.

Groups transactions by `YYYY-MM` key derived from `transaction.date`. Each group is rendered as a `<section>` with the heading `"Month YYYY"` (using `Intl.DateTimeFormat` for the month name), total amount, and transaction count. Groups are sorted in descending key order.

### 10. Navigation (`NavController`)

DOM elements: `<button data-view="main">`, `<button data-view="summary">`.

Toggles `state.activeView`, shows/hides `#view-main` and `#view-summary` with CSS class swaps. No page reload.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id        - UUID v4 generated via crypto.randomUUID()
 * @property {string} name      - Item name (1–100 chars, trimmed)
 * @property {number} amount    - Positive float, max 2 decimal places
 * @property {string} category  - Category label string
 * @property {string} date      - ISO 8601 date string (new Date().toISOString())
 */
```

Transactions are stored in `localStorage` as a JSON array under the key `evb_transactions`.

### Category

Categories are stored as a plain `string[]` under the key `evb_categories`. Default value: `['Food', 'Transport', 'Fun']`.

### AppSettings (Theme)

Stored as a plain string (`'light'` | `'dark'`) under the key `evb_theme`.

### localStorage Schema Summary

| Key               | Type       | Default value                     |
|-------------------|------------|-----------------------------------|
| `evb_transactions`| `Transaction[]` as JSON | `[]`               |
| `evb_categories`  | `string[]` as JSON      | `['Food','Transport','Fun']` |
| `evb_theme`       | plain string            | `'light'`          |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction storage round-trip

*For any* valid transaction object, serializing the transaction list to localStorage and then deserializing it must produce a list whose entry matches the original transaction on all fields (id, name, amount, category, date).

**Validates: Requirements 2.1, 2.4, 2.5**

### Property 2: Balance equals sum of amounts

*For any* non-empty list of transactions, the value shown by the Balance Display must equal the arithmetic sum of all transaction amounts, formatted to two decimal places.

**Validates: Requirements 5.1, 5.3, 5.4**

### Property 3: Whitespace-only names are rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), submitting it as a transaction item name must be rejected by the Validator and must leave the transaction list unchanged.

**Validates: Requirements 3.1, 3.5**

### Property 4: Category duplicate rejection is case-insensitive

*For any* existing category name and any new name that equals it after trimming and lowercasing, the Category Manager must reject the addition and leave the category list unchanged.

**Validates: Requirements 7.4**

### Property 5: Chart percentages sum to 100%

*For any* non-empty transaction list, the sum of all displayed pie-chart percentages across all categories must equal 100.0% (allowing ±0.1% rounding tolerance).

**Validates: Requirements 6.1, 6.4**

### Property 6: Monthly summary totals match transaction totals

*For any* transaction list, the sum of all per-month totals in the Monthly Summary must equal the global balance total.

**Validates: Requirements 9.1, 9.2**

### Property 7: Storage corruption falls back to defaults

*For any* value stored in a localStorage key that is not valid JSON, loading the application must produce a state with an empty transaction list, the default category set, and the light theme — not a runtime error.

**Validates: Requirements 2.6**

### Property 8: Deleted transaction is absent from storage and UI

*For any* transaction that has been deleted, it must be absent from both `state.transactions` and from the value returned by `StorageManager.load()` immediately after deletion.

**Validates: Requirements 4.4, 2.5**

---

## Error Handling

| Scenario | Handler | Outcome |
|---|---|---|
| `localStorage` unavailable (sandboxed iframe, private mode with quota=0) | `StorageManager.load()` `try/catch` | App runs in-memory with defaults; data is not persisted for the session |
| `localStorage` quota exceeded on `setItem` | `StorageManager.save()` `try/catch` on `QuotaExceededError` | Current in-memory state is preserved; a `console.warn` is emitted; the user is not shown a crash |
| Corrupt JSON in any storage key | `JSON.parse` `try/catch` per key | That key's value is replaced with its safe default |
| Form submitted with invalid fields | `Validator.validate()` returns errors array | Inline error messages rendered; transaction not added |
| Category added with blank or duplicate name | `CategoryManager.validate()` | Inline error message; category not added |
| Chart.js CDN fails to load | `window.onerror` or `typeof Chart === 'undefined'` check | Chart canvas is hidden; a fallback `<p>` states "Chart unavailable — please check your connection" |
| `crypto.randomUUID()` unavailable (very old browsers) | Feature-detect; fallback to `Math.random()`-based UUID | Transaction IDs remain unique within the session |

---

## Testing Strategy

### Approach

This feature is a pure client-side application with no build step or Node.js runtime. All logic lives in a single JS file. Testing targets the **pure logic functions** extracted from `app.js` and the **DOM interaction layer** via a lightweight browser test runner.

### Unit Tests (example-based)

Cover specific concrete scenarios:

- `Validator.validateName('')` → error
- `Validator.validateAmount('0')` → error; `Validator.validateAmount('999999999.99')` → valid
- `Validator.validateAmount('1.999')` → error (more than 2 decimal places)
- `StorageManager.load()` when all keys missing → returns default state
- `StorageManager.load()` when `evb_transactions` = `'NOT_JSON'` → transactions defaults to `[]`
- `formatCurrency(0)` → `'$0.00'`; `formatCurrency(1234.5)` → `'$1,234.50'`
- Monthly grouping: 3 transactions across 2 months produces 2 groups with correct totals
- Category duplicate check: `'food'` rejected when `'Food'` already in list

### Property-Based Tests

Property-based tests are written using **[fast-check](https://github.com/dubzzz/fast-check)** (loaded via CDN in the test HTML file). Each test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
`// Feature: expense-budget-visualizer, Property N: <property_text>`

**Property 1 — Transaction storage round-trip**
Generate arbitrary valid transactions (random names, amounts within range, random categories), serialize with `JSON.stringify`, parse back with `JSON.parse`, and assert field-by-field equality.
`// Feature: expense-budget-visualizer, Property 1: Transaction storage round-trip`

**Property 2 — Balance equals sum of amounts**
Generate an arbitrary array of transactions with random positive amounts. Assert that `computeBalance(transactions) === transactions.reduce((s,t) => s + t.amount, 0)` (using integer-safe arithmetic).
`// Feature: expense-budget-visualizer, Property 2: Balance equals sum of amounts`

**Property 3 — Whitespace-only names are rejected**
Generate strings from the fast-check `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` arbitrary. Assert that `Validator.validateName(str)` always returns an error.
`// Feature: expense-budget-visualizer, Property 3: Whitespace-only names are rejected`

**Property 4 — Category duplicate rejection is case-insensitive**
Generate a random non-empty category name and a variant that differs only in case/surrounding whitespace. Assert that adding the variant to a list containing the original is always rejected.
`// Feature: expense-budget-visualizer, Property 4: Category duplicate rejection is case-insensitive`

**Property 5 — Chart percentages sum to 100%**
Generate a list of transactions with random positive amounts across random categories. Assert that `computeChartData(transactions).percentages.reduce((s,p) => s+p, 0)` is within 0.1 of 100.
`// Feature: expense-budget-visualizer, Property 5: Chart percentages sum to 100%`

**Property 6 — Monthly summary totals match transaction totals**
Generate transactions with random amounts across random months. Assert that `sum(monthlySummary(transactions).map(m => m.total)) === computeBalance(transactions)`.
`// Feature: expense-budget-visualizer, Property 6: Monthly summary totals match transaction totals`

**Property 7 — Storage corruption falls back to defaults**
Generate arbitrary non-JSON strings and objects with missing/wrong-typed fields. For each, pre-seed localStorage, call `StorageManager.load()`, and assert the result equals the default state.
`// Feature: expense-budget-visualizer, Property 7: Storage corruption falls back to defaults`

**Property 8 — Deleted transaction is absent from storage and UI**
Generate a list of transactions and a random index to delete. Assert that after deletion neither `state.transactions` nor a fresh `StorageManager.load()` contains a transaction with that id.
`// Feature: expense-budget-visualizer, Property 8: Deleted transaction is absent from storage and UI`

### Integration / Smoke Tests

Manual or Playwright-based checks (run once):

- Open `index.html` in Chrome, Firefox, Edge, Safari — confirm no console errors.
- Add a transaction → list updates, balance updates, chart updates.
- Reload page → all data persists.
- Toggle theme → all elements switch within 200 ms; reload → theme persists.
- Navigate to Monthly Summary without page reload.
- Resize viewport to 320 px → no horizontal scroll.
