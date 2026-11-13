/**
 * Expense & Budget Visualizer
 * Client-side SPA — no build step, no frameworks, no server.
 * All state is persisted in localStorage and synchronised to the DOM
 * through a central render() call after every mutation.
 */

/* =========================================================
   STORAGE LAYER
   ========================================================= */

/** localStorage key constants */
const KEYS = {
  TRANSACTIONS: 'evb_transactions',
  CATEGORIES:   'evb_categories',
  THEME:        'evb_theme',
};

/**
 * Safe defaults returned when any key is missing or corrupt.
 * Defined once here so every fallback path uses the same values.
 */
const DEFAULTS = {
  transactions: [],
  categories:   ['Food', 'Transport', 'Fun'],
  theme:        'light',
};

/**
 * StorageManager — all localStorage I/O goes through this object.
 *
 * load()     → { transactions, categories, theme }
 * save(state) → void
 *
 * Design contract:
 *  - Each key is read/parsed inside its own try/catch so a corrupt
 *    value in one key never prevents the others from loading.
 *  - save() catches QuotaExceededError and emits console.warn without
 *    re-throwing, so the in-memory state remains intact even when the
 *    browser storage is full.
 */
const StorageManager = {
  /**
   * Load application state from localStorage.
   * Returns safe defaults for any key that is absent or unparseable.
   *
   * @returns {{ transactions: Transaction[], categories: string[], theme: string }}
   */
  load() {
    // --- transactions ---
    let transactions = DEFAULTS.transactions;
    try {
      const raw = localStorage.getItem(KEYS.TRANSACTIONS);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        // Guard against non-array values stored under this key.
        transactions = Array.isArray(parsed) ? parsed : DEFAULTS.transactions;
      }
    } catch (e) {
      console.warn('[StorageManager] Failed to parse transactions; using default.', e);
      transactions = DEFAULTS.transactions;
    }

    // --- categories ---
    let categories = DEFAULTS.categories;
    try {
      const raw = localStorage.getItem(KEYS.CATEGORIES);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        categories = Array.isArray(parsed) ? parsed : DEFAULTS.categories;
      }
    } catch (e) {
      console.warn('[StorageManager] Failed to parse categories; using default.', e);
      categories = DEFAULTS.categories;
    }

    // --- theme ---
    let theme = DEFAULTS.theme;
    try {
      const raw = localStorage.getItem(KEYS.THEME);
      // Theme is stored as a plain string (not JSON), so no JSON.parse needed.
      // Accept only the two known values to guard against corrupt data.
      if (raw === 'light' || raw === 'dark') {
        theme = raw;
      }
    } catch (e) {
      console.warn('[StorageManager] Failed to read theme; using default.', e);
      theme = DEFAULTS.theme;
    }

    return { transactions, categories, theme };
  },

  /**
   * Persist application state to localStorage.
   * Each key is written separately; a QuotaExceededError on any key
   * is caught and warned rather than thrown, so the caller never crashes.
   *
   * @param {{ transactions: Transaction[], categories: string[], theme: string }} state
   */
  save(state) {
    // Helper to attempt a single setItem and handle quota errors gracefully.
    const trySet = (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        if (
          e instanceof DOMException &&
          // QuotaExceededError name varies slightly across browsers.
          (e.name === 'QuotaExceededError' ||
           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           e.code === 22)
        ) {
          console.warn(
            `[StorageManager] localStorage quota exceeded while saving key "${key}". ` +
            'Current in-memory state is preserved but this change was not persisted.',
            e
          );
        } else {
          // Re-throw unexpected errors (e.g., SecurityError in sandboxed iframes).
          throw e;
        }
      }
    };

    trySet(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    trySet(KEYS.CATEGORIES,   JSON.stringify(state.categories));
    // Theme is a plain string — no need to JSON-stringify it.
    trySet(KEYS.THEME, state.theme);
  },
};

/* =========================================================
   VALIDATION LAYER
   ========================================================= */

/**
 * Validator — pure functions that check each Input_Form field.
 *
 * Each function returns:
 *   null          — the value is valid
 *   string        — a human-readable error message describing the problem
 *
 * No DOM side-effects; callers are responsible for rendering errors.
 */
const Validator = {
  /**
   * Validate the transaction item name.
   *
   * Rules (Requirements 3.1, 3.5):
   *  - Must be non-empty after trimming whitespace.
   *  - Must be at most 100 characters after trimming.
   *
   * @param {string} value
   * @returns {string|null}
   */
  validateName(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed.length === 0) {
      return 'Item name is required.';
    }
    if (trimmed.length > 100) {
      return 'Item name must be 100 characters or fewer.';
    }
    return null;
  },

  /**
   * Validate the transaction amount.
   *
   * Rules (Requirements 3.2, 3.6):
   *  - Must be parseable as a finite number.
   *  - Must be in the range 0.01 – 999,999,999.99 (inclusive).
   *  - Must have at most 2 decimal places.
   *
   * @param {string|number} value
   * @returns {string|null}
   */
  validateAmount(value) {
    const str = String(value ?? '').trim();

    // Reject empty input before attempting a numeric parse.
    if (str === '') {
      return 'Amount is required.';
    }

    const num = parseFloat(str);

    // Reject NaN, Infinity, and strings that parseFloat accepts only partially
    // (e.g. "1.2abc" — parseFloat returns 1.2 but the full string is not numeric).
    if (!isFinite(num) || String(num) !== str && !/^-?\d+(\.\d+)?$/.test(str)) {
      return 'Amount must be a valid number between 0.01 and 999,999,999.99 with up to two decimal places.';
    }

    // Range check.
    if (num < 0.01 || num > 999999999.99) {
      return 'Amount must be between 0.01 and 999,999,999.99.';
    }

    // Decimal-places check: split on '.' and inspect the fractional part.
    const decimalIndex = str.indexOf('.');
    if (decimalIndex !== -1 && str.length - decimalIndex - 1 > 2) {
      return 'Amount must have at most two decimal places.';
    }

    return null;
  },

  /**
   * Validate the selected category.
   *
   * Rules (Requirements 3.3):
   *  - Must be a non-empty, non-null, non-undefined value (i.e. the user
   *    must select a real category from the dropdown).
   *
   * @param {string|null|undefined} value
   * @returns {string|null}
   */
  validateCategory(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
      return 'Please select a category.';
    }
    return null;
  },
};

/* =========================================================
   STATE OBJECT
   ========================================================= */

/**
 * Central in-memory state — the single source of truth at runtime.
 * Populated from localStorage on DOMContentLoaded; mutated by event
 * handlers and persisted back through StorageManager.save().
 *
 * @type {{
 *   transactions: Transaction[],
 *   categories:   string[],
 *   theme:        'light' | 'dark',
 *   activeView:   'main' | 'summary'
 * }}
 */
const state = {
  transactions: [],
  categories:   [],
  theme:        'light',
  activeView:   'main',
};

/* =========================================================
   BOOTSTRAP — DOMContentLoaded
   ========================================================= */

/**
 * Entry point: runs once the HTML document is fully parsed.
 * Loads persisted state, applies the saved theme immediately so
 * there is no flash-of-wrong-theme, then hands off to render().
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Hydrate in-memory state from localStorage (safe defaults on error).
  const saved = StorageManager.load();
  state.transactions = saved.transactions;
  state.categories   = saved.categories;
  state.theme        = saved.theme;
  state.activeView   = 'main';

  // 2. Apply theme immediately to prevent flash-of-wrong-theme (Req 2.4, 8.4).
  document.documentElement.setAttribute('data-theme', state.theme);

  // 3. Initialize Chart.js instance (Req 1.4, 1.5).
  initChart();

  // 4. Wire all event handlers.
  initInputForm();
  initTransactionListListener();
  initCategoryManager();
  initThemeToggle();
  initNavController();

  // 5. Initial render — synchronise all DOM views to loaded state.
  render();
});

/* =========================================================
   RENDER — Category Dropdown
   ========================================================= */

/**
 * Populate #select-category from state.categories.
 *
 * Behaviour:
 *  - Clears and rebuilds all <option> elements on every call
 *    so the list always reflects the current state.categories array.
 *  - Inserts a disabled, pre-selected placeholder as the first option
 *    so the dropdown shows "-- Select a category --" in its default state
 *    and forces the user to make an explicit choice (Requirements 3.3, 3.7).
 *  - When state.categories is empty: disables the <select> element and
 *    reveals the #no-category-msg element so the user knows why the
 *    dropdown is not interactive (Requirements 3.8, 7.5).
 *  - When state.categories is non-empty: enables the <select> and hides
 *    #no-category-msg, then appends one <option> per category.
 *
 * This function is idempotent — calling it multiple times in a row
 * always produces the same DOM state.
 */
function renderCategoryDropdown() {
  const select      = document.getElementById('select-category');
  const noCategMsg  = document.getElementById('no-category-msg');

  // Guard: if the element doesn't exist yet (e.g. called before DOM is ready)
  // return silently so callers don't need to defend against null.
  if (!select) return;

  // ── Rebuild option list from scratch ──────────────────────────────────────
  select.innerHTML = '';

  // Default placeholder — disabled so it cannot be re-selected after the user
  // picks a real category, and selected so it appears as the initial hint text.
  const placeholder = document.createElement('option');
  placeholder.value       = '';
  placeholder.textContent = '-- Select a category --';
  placeholder.disabled    = true;
  placeholder.selected    = true;
  select.appendChild(placeholder);

  // ── Empty-categories branch ───────────────────────────────────────────────
  if (state.categories.length === 0) {
    select.disabled = true;
    if (noCategMsg) noCategMsg.hidden = false;
    return;
  }

  // ── Normal branch ─────────────────────────────────────────────────────────
  select.disabled = false;
  if (noCategMsg) noCategMsg.hidden = true;

  state.categories.forEach(cat => {
    const opt       = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

/* =========================================================
   UUID HELPER
   ========================================================= */

/**
 * Generate a UUID v4 string.
 * Uses the native crypto.randomUUID() when available (all modern browsers).
 * Falls back to a Math.random()-based implementation for older browsers.
 *
 * @returns {string} A UUID v4 string, e.g. "550e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 §4.4 compliant fallback using Math.random().
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* =========================================================
   INPUT FORM
   ========================================================= */

/**
 * Display an inline validation error adjacent to a form field.
 * Inserts a <span class="field-error"> element immediately after `field`.
 *
 * @param {HTMLElement} field   - The input/select element that failed.
 * @param {string}      message - The error text to display.
 */
function showFieldError(field, message) {
  const span = document.createElement('span');
  span.className = 'field-error';
  span.textContent = message;
  // Insert the error span right after the field in the DOM.
  field.insertAdjacentElement('afterend', span);
}

/**
 * Remove all previously rendered .field-error spans inside `container`.
 * Called at the start of every submit attempt so stale errors are cleared.
 *
 * @param {HTMLElement} container - The <form> element (or any ancestor).
 */
function clearFieldErrors(container) {
  container.querySelectorAll('.field-error').forEach(el => el.remove());
}

/**
 * InputForm — initialises the add-transaction form and its event handler.
 *
 * Responsibilities:
 *  - Validates all fields via Validator on every submit attempt.
 *  - Renders inline error messages adjacent to failing fields.
 *  - On valid submission: creates a Transaction, pushes it to state,
 *    persists via StorageManager, triggers render(), and resets the form.
 *  - Disables #select-category and shows an informational message when
 *    no categories are available (Requirements 3.8).
 *
 * Called from DOMContentLoaded after the state is hydrated.
 */
function initInputForm() {
  const form       = document.getElementById('form-add-transaction');
  const nameInput  = document.getElementById('input-name');
  const amountInput= document.getElementById('input-amount');
  const categorySelect = document.getElementById('select-category');

  // Guard: if the form isn't in the DOM yet, bail out silently.
  // (The HTML scaffold may not exist in earlier dev checkpoints.)
  if (!form) return;

  // ── Category-availability guard (Requirement 3.8) ──────────────────────
  // This helper is called by render() as well, but we also run it on init
  // so the UI is correct the moment the page loads.
  updateCategoryAvailability();

  // ── Submit handler ──────────────────────────────────────────────────────
  form.addEventListener('submit', event => {
    // Prevent the native browser form submission / page reload.
    event.preventDefault();

    // Clear stale inline errors from the previous attempt.
    clearFieldErrors(form);

    // ── Read raw field values ──────────────────────────────────────────
    const rawName     = nameInput  ? nameInput.value     : '';
    const rawAmount   = amountInput? amountInput.value   : '';
    const rawCategory = categorySelect ? categorySelect.value : '';

    // ── Validate each field ────────────────────────────────────────────
    const nameError     = Validator.validateName(rawName);
    const amountError   = Validator.validateAmount(rawAmount);
    const categoryError = Validator.validateCategory(rawCategory);

    let hasError = false;

    if (nameError) {
      showFieldError(nameInput, nameError);
      hasError = true;
    }
    if (amountError) {
      showFieldError(amountInput, amountError);
      hasError = true;
    }
    if (categoryError) {
      showFieldError(categorySelect, categoryError);
      hasError = true;
    }

    // Stop here if any field failed validation (Requirements 3.5, 3.6).
    if (hasError) return;

    // ── Build the Transaction object ───────────────────────────────────
    /**
     * @type {Transaction}
     */
    const transaction = {
      id:       generateUUID(),
      name:     rawName.trim(),
      amount:   parseFloat(rawAmount),
      category: rawCategory,
      date:     new Date().toISOString(),
    };

    // ── Mutate state, persist, re-render, reset ────────────────────────
    state.transactions.push(transaction);        // Requirement 3.4
    StorageManager.save(state);                  // Requirement 2.5
    render();                                    // Forward reference — defined in Task 12.1
    form.reset();                                // Requirement 3.7

    // After reset the placeholder option (empty value) is re-selected
    // automatically by the browser, satisfying Requirement 3.7's
    // "category dropdown showing its default unselected placeholder".
  });
}

/**
 * Update the enabled/disabled state of #select-category based on whether
 * state.categories is empty.  Called by initInputForm() on load and by
 * renderCategoryDropdown() on every render pass.
 *
 * When no categories are available:
 *  - The <select> is disabled.
 *  - A sibling #category-unavailable-msg element (if present in the HTML)
 *    is made visible.
 * When categories exist the reverse is applied.
 *
 * Requirements: 3.8
 */
function updateCategoryAvailability() {
  const categorySelect = document.getElementById('select-category');
  const unavailableMsg = document.getElementById('category-unavailable-msg');

  if (!categorySelect) return;

  const isEmpty = state.categories.length === 0;
  categorySelect.disabled = isEmpty;

  if (unavailableMsg) {
    unavailableMsg.style.display = isEmpty ? '' : 'none';
  }
}

/* =========================================================
   RENDER — Balance Display
   ========================================================= */

/**
 * Compute total balance from a transaction array.
 * Exported as a pure function so property tests can import it directly.
 * @param {Transaction[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Update #balance-total with the formatted currency sum of all transactions.
 * Shows $0.00 when no transactions exist (Requirement 5.5).
 */
function renderBalance() {
  const el = document.getElementById('balance-total');
  if (!el) return;
  const total = computeBalance(state.transactions);
  el.textContent = total.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/* =========================================================
   CATEGORY MANAGER
   ========================================================= */

/**
 * Validate a new category name.
 * @param {string} value - The raw input value
 * @param {string[]} existingCategories - Current categories list
 * @returns {string|null} error message or null if valid
 */
function validateCategoryName(value, existingCategories) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    return 'Category name cannot be blank.';
  }
  if (trimmed.length > 50) {
    return 'Category name must be 50 characters or fewer.';
  }
  const isDuplicate = existingCategories.some(
    c => c.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return 'That category already exists.';
  }
  return null;
}

/**
 * Initialize the add-category form handler.
 * Called from DOMContentLoaded.
 */
function initCategoryManager() {
  const form = document.getElementById('form-add-category');
  const nameInput = document.getElementById('input-category-name');
  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    // Clear prior errors
    form.querySelectorAll('.field-error').forEach(el => el.remove());

    const rawValue = nameInput ? nameInput.value : '';
    const error = validateCategoryName(rawValue, state.categories);

    if (error) {
      if (nameInput) {
        const span = document.createElement('span');
        span.className = 'field-error';
        span.textContent = error;
        nameInput.insertAdjacentElement('afterend', span);
      }
      return;
    }

    const trimmed = rawValue.trim();
    state.categories.push(trimmed);
    StorageManager.save(state);
    renderCategoryDropdown();
    form.reset();
  });
}

/* =========================================================
   RENDER — Transaction List
   ========================================================= */

/**
 * Render all transactions into #transaction-list as <li> rows.
 *
 * Behaviour:
 *  - Clears and rebuilds the list on every call (idempotent).
 *  - Sorts in reverse-chronological order (most recent first) — Requirement 4.1.
 *  - Each row shows: item name, category + date meta, formatted amount,
 *    and a delete button with data-id set to the transaction id — Requirement 4.2.
 *  - When state.transactions is empty, shows an empty-state message — Requirement 4.5.
 *
 * The delete click listener is NOT attached here; it is registered once
 * via initTransactionListListener() called from DOMContentLoaded.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
function renderTransactionList() {
  const ul = document.getElementById('transaction-list');
  if (!ul) return;

  ul.innerHTML = '';

  if (state.transactions.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No expenses recorded yet. Add one above!';
    ul.appendChild(li);
    return;
  }

  // Reverse-chronological order (most recent first) — Requirement 4.1
  const sorted = [...state.transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  sorted.forEach(txn => {
    const li = document.createElement('li');

    // ── Info section ──────────────────────────────────────────────────────
    const info = document.createElement('div');
    info.className = 'txn-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'txn-name';
    nameEl.textContent = txn.name;

    const metaEl = document.createElement('span');
    metaEl.className = 'txn-meta';
    const dateStr = new Date(txn.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    metaEl.textContent = `${txn.category} · ${dateStr}`;

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    // ── Actions section ───────────────────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'txn-actions';

    const amountEl = document.createElement('span');
    amountEl.className = 'txn-amount';
    amountEl.textContent = txn.amount.toLocaleString('en-US', {
      style: 'currency', currency: 'USD',
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.dataset.id = txn.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${txn.name}`);

    actions.appendChild(amountEl);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    ul.appendChild(li);
  });
}

/**
 * Attach a single delegated click listener on #transaction-list that handles
 * delete button clicks for all current and future transaction rows.
 *
 * Uses event.target.closest('[data-id]') so the listener survives list
 * rebuilds without needing to be re-registered — Requirement 4.4.
 *
 * Called once from DOMContentLoaded after the DOM is ready.
 */
function initTransactionListListener() {
  const ul = document.getElementById('transaction-list');
  if (!ul) return;

  ul.addEventListener('click', event => {
    const btn = event.target.closest('[data-id]');
    if (!btn) return;

    const id = btn.dataset.id;
    // Remove the matching transaction from state — Requirement 4.4.
    state.transactions = state.transactions.filter(t => t.id !== id);
    StorageManager.save(state);   // Persist deletion — Requirement 2.5.
    render();                     // Synchronise all views — Requirements 5.4, 6.3.
  });
}

/* =========================================================
   THEME TOGGLE
   ========================================================= */

/**
 * Update the #theme-toggle button label to reflect the current theme.
 */
function updateThemeToggleLabel() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.textContent = state.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  btn.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

/**
 * Initialize the theme toggle button click handler.
 * Called from DOMContentLoaded.
 *
 * Responsibilities:
 *  - Sets the initial button label to match the loaded theme.
 *  - On click: toggles state.theme, updates the data-theme attribute
 *    so CSS custom properties swap instantly (within 200 ms per the CSS
 *    transition defined in style.css), updates the button label, and
 *    persists the new preference via StorageManager.
 *
 * Requirements: 8.1, 8.2, 8.3
 */
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // Set initial label to match whatever theme was loaded from storage.
  updateThemeToggleLabel();

  btn.addEventListener('click', () => {
    // Toggle between the two valid theme values.
    state.theme = state.theme === 'light' ? 'dark' : 'light';

    // Apply theme globally via the HTML element attribute so every
    // [data-theme] CSS rule updates in a single repaint.
    document.documentElement.setAttribute('data-theme', state.theme);

    // Keep button label in sync with the new state.
    updateThemeToggleLabel();

    // Persist the preference so it survives a page reload (Requirement 8.3).
    StorageManager.save(state);
  });
}

/* =========================================================
   NAV CONTROLLER
   ========================================================= */

/**
 * Update view visibility and active button state based on state.activeView.
 */
function updateViewVisibility() {
  const viewMain    = document.getElementById('view-main');
  const viewSummary = document.getElementById('view-summary');

  if (viewMain) {
    viewMain.style.display = state.activeView === 'main' ? '' : 'none';
  }
  if (viewSummary) {
    viewSummary.style.display = state.activeView === 'summary' ? '' : 'none';
  }

  // Update active state on nav buttons
  document.querySelectorAll('[data-view]').forEach(btn => {
    if (btn.dataset.view === state.activeView) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Initialize the navigation controller.
 * Attaches click handlers to all [data-view] buttons.
 * Called from DOMContentLoaded.
 *
 * Requirements: 9.6, 10.3
 */
function initNavController() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'main' || view === 'summary') {
        state.activeView = view;
        updateViewVisibility();
      }
    });
  });
  // Apply initial visibility
  updateViewVisibility();
}

/* =========================================================
   CHART ENGINE
   ========================================================= */

/** Module-level Chart.js instance; created once and updated in-place. */
let chartInstance = null;

/**
 * Compute chart data from transactions.
 * Returns { labels, percentages, amounts } or null if no data.
 * Exported as a pure function for property tests (Property 5).
 * @param {Transaction[]} transactions
 * @returns {{ labels: string[], percentages: number[], amounts: number[] }|null}
 */
function computeChartData(transactions) {
  if (!transactions || transactions.length === 0) return null;

  // Aggregate per-category totals
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  // Filter to categories with total > 0
  const categories = Object.keys(totals).filter(cat => totals[cat] > 0);
  if (categories.length === 0) return null;

  const grandTotal = categories.reduce((sum, cat) => sum + totals[cat], 0);
  const percentages = categories.map(cat =>
    parseFloat((totals[cat] / grandTotal * 100).toFixed(1))
  );
  const labels = categories.map((cat, i) => `${cat} ${percentages[i]}%`);

  return {
    labels,
    percentages,
    amounts: categories.map(cat => totals[cat]),
  };
}

/**
 * Initialize the Chart.js pie chart on DOMContentLoaded.
 * Guards against Chart.js CDN failing to load.
 */
function initChart() {
  const canvas = document.getElementById('spending-chart');
  const chartEmpty = document.getElementById('chart-empty');

  if (typeof Chart === 'undefined') {
    // CDN failed to load
    if (canvas) canvas.style.display = 'none';
    if (chartEmpty) {
      chartEmpty.textContent = 'Chart unavailable — please check your connection';
      chartEmpty.style.display = '';
    }
    return;
  }

  if (!canvas) return;

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true },
      },
    },
  });
}

/** Chart.js colour palette for pie segments */
const CHART_COLORS = [
  '#4f6ef7', '#f97316', '#10b981', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#6366f1',
];

/**
 * Update the pie chart to reflect current state.transactions.
 * Shows empty state when no transactions exist.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
function renderChart() {
  const canvas = document.getElementById('spending-chart');
  const chartEmpty = document.getElementById('chart-empty');

  // If Chart.js never loaded, guard is handled in initChart(); just ensure
  // empty state is shown when there are no transactions.
  if (!chartInstance) {
    if (canvas) canvas.style.display = 'none';
    if (chartEmpty && chartEmpty.textContent !== 'Chart unavailable — please check your connection') {
      chartEmpty.textContent = 'No spending data available';
      chartEmpty.style.display = '';
    }
    return;
  }

  const data = computeChartData(state.transactions);

  if (!data) {
    // No transactions — show placeholder, hide canvas
    if (canvas) canvas.style.display = 'none';
    if (chartEmpty) {
      chartEmpty.textContent = 'No spending data available';
      chartEmpty.style.display = '';
    }
    return;
  }

  // Show canvas, hide placeholder
  if (canvas) canvas.style.display = '';
  if (chartEmpty) chartEmpty.style.display = 'none';

  // Update chart in-place (do NOT destroy and re-create)
  chartInstance.data = {
    labels: data.labels,
    datasets: [{
      data: data.amounts,
      backgroundColor: data.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderWidth: 2,
    }],
  };
  chartInstance.update();
}

// Guard against CDN script error
window.addEventListener('error', event => {
  if (event.filename && event.filename.includes('chart')) {
    const canvas = document.getElementById('spending-chart');
    const chartEmpty = document.getElementById('chart-empty');
    if (canvas) canvas.style.display = 'none';
    if (chartEmpty) {
      chartEmpty.textContent = 'Chart unavailable — please check your connection';
      chartEmpty.style.display = '';
    }
  }
}, true);

/* =========================================================
   MONTHLY SUMMARY
   ========================================================= */

/**
 * Group transactions by YYYY-MM and return sorted summary data.
 * Pure function for use in both render and property tests (Property 6).
 * @param {Transaction[]} transactions
 * @returns {{ key: string, month: string, year: string, total: number, count: number }[]}
 */
function monthlySummary(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) {
      groups[key] = { key, year: String(date.getFullYear()), monthIndex: date.getMonth(), total: 0, count: 0 };
    }
    groups[key].total += t.amount;
    groups[key].count += 1;
  });

  return Object.values(groups)
    .sort((a, b) => b.key.localeCompare(a.key)); // Descending YYYY-MM
}

/**
 * Format a currency amount as USD string.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Render the monthly summary into #monthly-summary.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
function renderMonthlySummary() {
  const container = document.getElementById('monthly-summary');
  if (!container) return;

  container.innerHTML = '';

  if (state.transactions.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No transactions recorded yet.';
    container.appendChild(p);
    return;
  }

  const groups = monthlySummary(state.transactions);

  groups.forEach(group => {
    const section = document.createElement('section');

    // Heading: "November 2026"
    const heading = document.createElement('h3');
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(parseInt(group.year, 10), group.monthIndex, 1)
    );
    heading.textContent = `${monthName} ${group.year}`;
    section.appendChild(heading);

    // Stats
    const stats = document.createElement('div');
    stats.className = 'month-stats';

    const totalEl = document.createElement('span');
    totalEl.className = 'month-total';
    totalEl.textContent = `Total: ${formatCurrency(group.total)}`;

    const countEl = document.createElement('span');
    countEl.textContent = `${group.count} transaction${group.count !== 1 ? 's' : ''}`;

    stats.appendChild(totalEl);
    stats.appendChild(countEl);
    section.appendChild(stats);
    container.appendChild(section);
  });
}

/* =========================================================
   CENTRAL RENDER
   ========================================================= */

/**
 * Central render function — synchronises all DOM views to the current state.
 * Called after every state mutation (add/delete transaction, add category).
 *
 * Calls each sub-renderer in sequence so all views remain consistent after
 * any mutation.  The sequence order is:
 *   1. Transaction list  — most complex, sets the stage for balance/chart.
 *   2. Balance           — cheap sum, always consistent with the list.
 *   3. Chart             — reads state.transactions directly (not the DOM).
 *   4. Monthly summary   — reads state.transactions directly.
 *   5. Category dropdown — reads state.categories; must be last so a newly
 *                          added category is reflected before the next submit.
 *
 * All sub-renderers are idempotent, so calling render() multiple times in
 * a row is safe and always produces the same DOM result.
 *
 * Requirements: 5.3, 5.4, 6.2, 6.3, 10.2
 */
function render() {
  renderTransactionList();    // Requirements 4.1–4.5
  renderBalance();            // Requirements 5.1, 5.3–5.5
  renderChart();              // Requirements 6.1–6.5
  renderMonthlySummary();     // Requirements 9.1–9.5
  renderCategoryDropdown();   // Requirements 3.3, 3.8, 7.5
}
