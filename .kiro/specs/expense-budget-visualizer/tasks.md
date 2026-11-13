# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side, single-page expense tracker using only HTML, CSS, and Vanilla JavaScript. The app is delivered as a static file trio (`index.html`, `css/style.css`, `js/app.js`) with Chart.js v4 loaded from CDN. All state lives in `localStorage` and is synchronized to the DOM through a central `render()` function after every mutation.

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` with correct `<head>` metadata, `<link>` to `css/style.css`, `<script defer>` for Chart.js CDN (`https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`), and `<script defer src="js/app.js">`
  - Create empty `css/style.css` and empty `js/app.js` files
  - Add the top navigation bar markup: `<button id="theme-toggle">`, `<button data-view="main">`, `<button data-view="summary">`
  - Add `#balance-total` element in the top area
  - Add `#view-main` section containing: `#form-add-transaction` (fields `#input-name`, `#input-amount`, `#select-category`), `#transaction-list` (`<ul>`), `<canvas id="spending-chart">`, `#chart-empty` paragraph, `#form-add-category` with `#input-category-name`
  - Add `#view-summary` section containing `#monthly-summary`
  - Set `data-theme="light"` on `<html>`
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2. Implement StorageManager and State initialization
  - [x] 2.1 Implement `StorageManager` with `KEYS` constants (`evb_transactions`, `evb_categories`, `evb_theme`), `load()` with per-key `try/catch` and safe defaults, and `save(state)` with `try/catch` handling `QuotaExceededError`
    - `load()` must return `{ transactions: [], categories: ['Food', 'Transport', 'Fun'], theme: 'light' }` on any parse error
    - `save()` must emit `console.warn` on quota exceeded without throwing
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 2.2 Initialize `state` object (`transactions`, `categories`, `theme`, `activeView`) from `StorageManager.load()` on `DOMContentLoaded`
    - Apply saved theme by setting `document.documentElement.setAttribute('data-theme', state.theme)` immediately on load
    - _Requirements: 2.4, 8.4_
  - [ ]* 2.3 Write property test for StorageManager round-trip (Property 1)
    - **Property 1: Transaction storage round-trip**
    - Generate arbitrary valid transactions, serialize with `JSON.stringify`, parse back, assert field-by-field equality
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Transaction storage round-trip`
    - **Validates: Requirements 2.1, 2.4, 2.5**
  - [ ]* 2.4 Write property test for storage corruption fallback (Property 7)
    - **Property 7: Storage corruption falls back to defaults**
    - Generate arbitrary non-JSON strings, pre-seed `localStorage`, call `StorageManager.load()`, assert result equals default state
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Storage corruption falls back to defaults`
    - **Validates: Requirements 2.6**

- [x] 3. Implement CSS theming foundation and base layout
  - [x] 3.1 Define all CSS custom property pairs under `[data-theme="light"]` and `[data-theme="dark"]` selectors (background, surface, text, input, border, accent colours)
    - Set minimum body font size to 14px
    - Add CSS transition (`200ms`) on background-color and color for all themed elements to satisfy theme switch timing
    - _Requirements: 8.2, 10.4_
  - [x] 3.2 Implement responsive layout using CSS Grid/Flexbox
    - Ensure no horizontal scroll at 320px viewport width
    - Scale layout up to 1920px without overflow
    - Make `#transaction-list` scrollable when content overflows its container
    - Ensure `#balance-total` area is always visible at the top
    - _Requirements: 4.3, 5.2, 10.5_

- [x] 4. Implement Validator and InputForm
  - [x] 4.1 Implement `Validator` with `validateName(value)`, `validateAmount(value)`, and `validateCategory(value)` pure functions
    - `validateName`: reject empty/whitespace-only strings and strings over 100 chars
    - `validateAmount`: reject non-numeric, values outside 0.01–999999999.99, and values with more than 2 decimal places
    - `validateCategory`: reject empty selection
    - Return error message strings on failure, `null` on success
    - _Requirements: 3.1, 3.2, 3.5, 3.6_
  - [x] 4.2 Implement `InputForm` event handler on `#form-add-transaction` submit
    - Run all validators; on failure render `<span class="field-error">` elements adjacent to failing fields
    - On success: create `Transaction` object with `crypto.randomUUID()` (falling back to `Math.random()`-based UUID if unavailable), push to `state.transactions`, call `StorageManager.save(state)`, call `render()`, reset form
    - Disable `#select-category` and show "no categories available" message when `state.categories` is empty
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ]* 4.3 Write property test for whitespace name rejection (Property 3)
    - **Property 3: Whitespace-only names are rejected**
    - Generate strings from `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`, assert `Validator.validateName(str)` always returns an error
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Whitespace-only names are rejected`
    - **Validates: Requirements 3.1, 3.5**
  - [ ]* 4.4 Write unit tests for Validator edge cases
    - `validateName('')` → error; `validateAmount('0')` → error; `validateAmount('999999999.99')` → valid; `validateAmount('1.999')` → error
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 5. Checkpoint — Ensure StorageManager and Validator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement render functions: Transaction List and Balance Display
  - [x] 6.1 Implement `renderTransactionList()` targeting `#transaction-list`
    - Render transactions in reverse-chronological order as `<li>` rows showing name, amount, category, and date
    - Add a delete `<button data-id="…">` to each row
    - Show empty-state message when `state.transactions` is empty
    - Attach a single delegated click listener on `#transaction-list` that finds `event.target.closest('[data-id]')`, removes the matching transaction from `state.transactions`, calls `StorageManager.save(state)`, and calls `render()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 6.2 Implement `renderBalance()` targeting `#balance-total`
    - Compute balance as `transactions.reduce((sum, t) => sum + t.amount, 0)`
    - Format with `toLocaleString('en-US', { style: 'currency', currency: 'USD' })`
    - Show `$0.00` when no transactions exist
    - _Requirements: 5.1, 5.3, 5.4, 5.5_
  - [ ]* 6.3 Write property test for balance computation (Property 2)
    - **Property 2: Balance equals sum of amounts**
    - Generate arbitrary arrays of transactions with random positive amounts, assert `computeBalance(transactions) === transactions.reduce((s, t) => s + t.amount, 0)`
    - Tag: `// Feature: expense-budget-visualizer, Property 2: Balance equals sum of amounts`
    - **Validates: Requirements 5.1, 5.3, 5.4**
  - [ ]* 6.4 Write property test for deleted transaction absence (Property 8)
    - **Property 8: Deleted transaction is absent from storage and UI**
    - Generate a list of transactions and a random index to delete; assert neither `state.transactions` nor a fresh `StorageManager.load()` contains a transaction with that id after deletion
    - Tag: `// Feature: expense-budget-visualizer, Property 8: Deleted transaction is absent from storage and UI`
    - **Validates: Requirements 4.4, 2.5**

- [x] 7. Implement ChartEngine
  - [x] 7.1 Implement `renderChart()` using the Chart.js instance
    - Create a single `Chart` instance (`type: 'pie'`) on `DOMContentLoaded`; subsequently update via `chart.data = …; chart.update()` without destroying the instance
    - Compute per-category totals from `state.transactions`; include only categories with total > 0
    - Build labels as `${category} ${pct}%` where `pct = (categoryTotal / grandTotal * 100).toFixed(1)`
    - Hide `<canvas id="spending-chart">` and show `#chart-empty` ("No spending data available") when no transactions exist
    - Add `window.onerror` / `typeof Chart === 'undefined'` guard: hide canvas and show "Chart unavailable — please check your connection"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 7.2 Write property test for chart percentages sum (Property 5)
    - **Property 5: Chart percentages sum to 100%**
    - Generate a list of transactions with random positive amounts across random categories; assert `computeChartData(transactions).percentages.reduce((s, p) => s + p, 0)` is within 0.1 of 100
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Chart percentages sum to 100%`
    - **Validates: Requirements 6.1, 6.4**

- [x] 8. Implement CategoryManager
  - [x] 8.1 Implement `renderCategoryDropdown()` to populate `#select-category` from `state.categories`
    - Include a default unselected placeholder option
    - Disable the dropdown and show "no categories available" message when `state.categories` is empty
    - _Requirements: 3.3, 3.8, 7.5_
  - [x] 8.2 Implement `CategoryManager` event handler on `#form-add-category` submit
    - Validate new name: trim whitespace, reject blank names with inline error, reject duplicates (case-insensitive) with inline error
    - On success: append to `state.categories`, call `StorageManager.save(state)`, call `renderCategoryDropdown()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 8.3 Write property test for category duplicate rejection (Property 4)
    - **Property 4: Category duplicate rejection is case-insensitive**
    - Generate a random non-empty category name and a variant differing only in case/surrounding whitespace; assert adding the variant to a list containing the original is always rejected
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Category duplicate rejection is case-insensitive`
    - **Validates: Requirements 7.4**
  - [ ]* 8.4 Write unit tests for CategoryManager validation
    - Blank name → error; `'food'` rejected when `'Food'` already in list; valid unique name → accepted
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 9. Implement ThemeToggle and NavController
  - [x] 9.1 Implement `ThemeToggle` click handler on `#theme-toggle`
    - Toggle `state.theme` between `'light'` and `'dark'`
    - Apply via `document.documentElement.setAttribute('data-theme', state.theme)`
    - Update button label/icon to reflect current mode
    - Call `StorageManager.save(state)` to persist preference
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 9.2 Implement `NavController` click handlers on `[data-view]` buttons
    - Toggle `state.activeView` between `'main'` and `'summary'`
    - Show/hide `#view-main` and `#view-summary` via CSS class swap (no page reload)
    - _Requirements: 9.6, 10.3_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement MonthlySummary
  - [x] 11.1 Implement `renderMonthlySummary()` targeting `#monthly-summary`
    - Group transactions by `YYYY-MM` key derived from `transaction.date`
    - Render each group as a `<section>` with heading `"Month YYYY"` (using `Intl.DateTimeFormat` for month name), total amount formatted as currency, and transaction count
    - Sort groups in descending `YYYY-MM` order (most recent first)
    - Show empty-state message when no transactions exist
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 11.2 Write property test for monthly summary totals (Property 6)
    - **Property 6: Monthly summary totals match transaction totals**
    - Generate transactions with random amounts across random months; assert `sum(monthlySummary(transactions).map(m => m.total)) === computeBalance(transactions)`
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Monthly summary totals match transaction totals`
    - **Validates: Requirements 9.1, 9.2**
  - [ ]* 11.3 Write unit test for monthly grouping logic
    - 3 transactions across 2 months produces 2 groups with correct totals; `formatCurrency(0)` → `'$0.00'`; `formatCurrency(1234.5)` → `'$1,234.50'`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 12. Wire central `render()` function and perform integration
  - [x] 12.1 Implement `render()` to call `renderTransactionList()`, `renderBalance()`, `renderChart()`, `renderMonthlySummary()`, and `renderCategoryDropdown()` in sequence
    - Verify every mutation path (add transaction, delete transaction, add category, theme toggle, nav switch) calls the correct subset of render functions within the 100 ms timing budget
    - _Requirements: 5.3, 5.4, 6.2, 6.3, 10.2_
  - [x] 12.2 Wire `DOMContentLoaded` bootstrap: call `StorageManager.load()` → populate `state` → apply theme attribute → create Chart instance → call `render()`
    - _Requirements: 2.4, 8.4, 1.4, 1.5_
  - [ ]* 12.3 Write integration smoke test
    - Add a transaction → assert list, balance, chart all update; reload state from storage → assert data persists; delete transaction → assert list, balance, chart update; toggle theme → assert `data-theme` attribute and `state.theme` match
    - _Requirements: 2.4, 2.5, 4.4, 5.3, 5.4, 6.2, 6.3, 8.3_

- [ ] 13. Final checkpoint — Ensure all tests pass and UI is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- All property tests use **fast-check** loaded via CDN in a test HTML file; each test runs a minimum of 100 iterations
- Each property test task is tagged with `// Feature: expense-budget-visualizer, Property N: <title>` for traceability
- The Chart.js instance is created once and updated in-place — never destroyed and re-created
- CSS custom properties under `[data-theme]` selectors handle all theme switching; no JavaScript style manipulation beyond the `data-theme` attribute
- `crypto.randomUUID()` is used for transaction IDs with a `Math.random()`-based fallback for older browsers
- All render functions are idempotent: calling `render()` multiple times produces the same result

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.2", "8.1"] },
    { "id": 3, "tasks": ["4.3", "4.4", "6.1", "6.2", "8.2", "9.1", "9.2"] },
    { "id": 4, "tasks": ["6.3", "6.4", "7.1", "8.3", "8.4", "11.1"] },
    { "id": 5, "tasks": ["7.2", "11.2", "11.3", "12.1"] },
    { "id": 6, "tasks": ["12.2"] },
    { "id": 7, "tasks": ["12.3"] }
  ]
}
```
