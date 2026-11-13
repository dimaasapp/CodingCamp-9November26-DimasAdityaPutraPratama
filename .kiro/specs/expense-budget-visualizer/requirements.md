# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track their personal spending, categorize transactions, and visualize their budget distribution through charts. Built entirely with HTML, CSS, and Vanilla JavaScript, the app stores all data locally in the browser using the Local Storage API — no backend server or account setup required. Users can add, delete, and categorize expenses; view a real-time pie chart of spending by category; create custom categories; toggle between dark and light themes; and review monthly summaries of their transactions.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Input_Form**: The UI form component used to submit new transactions.
- **Category**: A label that groups transactions (e.g., Food, Transport, Fun, or a user-defined label).
- **Category_Manager**: The component responsible for managing the list of available categories, including defaults and custom ones.
- **Chart**: The pie chart visualization showing spending distribution by category.
- **Chart_Engine**: The chart rendering component, powered by Chart.js or an equivalent library.
- **Balance_Display**: The UI component that shows the current total amount spent across all transactions.
- **Storage**: The browser Local Storage API used for persisting transaction and settings data.
- **Monthly_Summary**: The view that aggregates and displays transactions grouped by calendar month.
- **Theme_Toggle**: The UI control that switches the App between dark and light visual modes.
- **Validator**: The component that checks Input_Form fields before a transaction is submitted.

## Requirements

### Requirement 1: Technology Stack

**User Story:** As a developer, I want the app to be built with standard web technologies, so that it runs in any modern browser without installation or server infrastructure.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript — no frontend frameworks (React, Vue, Angular, etc.) are permitted.
2. THE App SHALL contain exactly one CSS file located in the `css/` directory.
3. THE App SHALL contain exactly one JavaScript file located in the `js/` directory.
4. WHEN the App is opened in the latest stable version of Chrome, Firefox, Edge, or Safari, THE App SHALL render all UI elements without errors, missing layout sections, or broken functionality.
5. THE App SHALL function by opening its HTML file directly in a browser without requiring a local server, build tool, package manager, or internet connection.

---

### Requirement 2: Data Persistence

**User Story:** As a user, I want my expense data to be saved between browser sessions, so that I do not lose my transaction history when I close the tab.

#### Acceptance Criteria

1. THE Storage SHALL persist all transactions client-side using the browser Local Storage API.
2. THE Storage SHALL persist user-defined categories client-side.
3. THE Storage SHALL persist the user's selected theme (dark or light) client-side.
4. WHEN the App loads, THE Storage SHALL restore all previously saved transactions, categories, and theme preferences.
5. WHEN a transaction is added, edited, or deleted, THE Storage SHALL update the stored transaction list within 1 second of the operation completing.
6. IF the data retrieved from Local Storage is missing or cannot be parsed, THEN THE Storage SHALL initialize with an empty transaction list, the default category set, and the light theme.

---

### Requirement 3: Input Form

**User Story:** As a user, I want to enter expense details through a form, so that I can record a new transaction quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name accepting between 1 and 100 non-whitespace characters.
2. THE Input_Form SHALL provide a numeric field for the transaction amount accepting values between 0.01 and 999,999,999.99 with up to two decimal places.
3. THE Input_Form SHALL provide a dropdown selector populated with all available categories.
4. WHEN the user submits the Input_Form with all fields filled and the amount greater than zero, THE Input_Form SHALL add the transaction to the Transaction_List.
5. IF the user submits the Input_Form with one or more fields empty or unselected, THEN THE Validator SHALL display an inline error message adjacent to each missing field identifying which fields are missing.
6. IF the user submits the Input_Form with an amount outside the range of 0.01 to 999,999,999.99 or with more than two decimal places, THEN THE Validator SHALL display an inline error message adjacent to the amount field indicating that the amount must be a positive number between 0.01 and 999,999,999.99 with up to two decimal places.
7. WHEN a transaction is successfully submitted, THE Input_Form SHALL clear all fields to their default state, with the item name field empty, the amount field empty, and the category dropdown showing its default unselected placeholder.
8. IF the user opens the Input_Form and no categories are available, THEN THE Input_Form SHALL disable the category dropdown and display a message indicating that no categories are available.

---

### Requirement 4: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions in reverse-chronological order (most recent first).
2. THE Transaction_List SHALL display the item name, amount, category, and date for each transaction.
3. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible area.
4. WHEN the user clicks the delete button displayed on a transaction row, THE Transaction_List SHALL immediately remove that transaction from the list and from Storage without requiring a confirmation step.
5. WHEN the Transaction_List contains no transactions, THE Transaction_List SHALL display an empty-state message indicating no expenses have been recorded and prompting the user to add one.

---

### Requirement 5: Total Balance Display

**User Story:** As a user, I want to see my total spending at a glance, so that I can understand my overall budget consumption.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts as the total spent, formatted as a currency value with two decimal places and a currency symbol (e.g., $0.00).
2. WHILE the App is open, THE Balance_Display SHALL be visible at the top of the App at all times.
3. WHEN a transaction is added, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds without requiring a page reload.
4. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds without requiring a page reload.
5. WHEN no transactions exist, THE Balance_Display SHALL display a total of $0.00.

---

### Requirement 6: Visual Chart

**User Story:** As a user, I want a pie chart showing my spending by category, so that I can see which areas consume the most of my budget.

#### Acceptance Criteria

1. THE Chart_Engine SHALL render a pie chart that displays each category's share of total spending, including only categories with a total spending amount greater than zero.
2. WHEN a transaction is added, THE Chart_Engine SHALL update the chart to reflect the new spending distribution within 100 milliseconds without requiring a page reload.
3. WHEN a transaction is deleted, THE Chart_Engine SHALL update the chart to reflect the revised spending distribution within 100 milliseconds without requiring a page reload.
4. THE Chart_Engine SHALL label each pie segment with the category name and its percentage of total spending rounded to one decimal place (e.g., "Food 42.3%").
5. WHEN no transactions exist, THE Chart_Engine SHALL display a placeholder message stating "No spending data available" instead of an empty chart.

---

### Requirement 7: Category Management

**User Story:** As a user, I want to create custom spending categories beyond the defaults, so that I can organize my expenses to match my personal lifestyle.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide the default categories: Food, Transport, and Fun.
2. THE Category_Manager SHALL allow the user to add a custom category by entering a unique name between 1 and 50 characters after trimming leading and trailing whitespace.
3. IF the user submits a custom category name that is empty or consists only of whitespace after trimming, THEN THE Validator SHALL display an inline error message stating that the category name cannot be blank.
4. IF the user submits a custom category name that already exists (case-insensitive comparison after trimming), THEN THE Validator SHALL display an inline error message stating that the category already exists.
5. WHEN a custom category is added, THE Category_Manager SHALL make the new category immediately available in the Input_Form dropdown.
6. THE Category_Manager SHALL persist all custom categories via Storage so they are available after the page is reloaded.

---

### Requirement 8: Dark / Light Mode

**User Story:** As a user, I want to toggle between dark and light themes, so that I can use the app comfortably in different lighting environments.

#### Acceptance Criteria

1. THE Theme_Toggle SHALL provide a labeled, permanently visible control in the top navigation area to switch between dark and light modes.
2. WHEN the user activates the Theme_Toggle, THE App SHALL switch the theme of all backgrounds, text, inputs, and icons within 200 milliseconds.
3. THE Storage SHALL persist the user's theme preference so the same theme is applied when the App is next opened.
4. WHEN the App loads for the first time with no stored preference, THE App SHALL apply the light theme by default.

---

### Requirement 9: Monthly Summary View

**User Story:** As a user, I want to view a summary of my expenses grouped by month, so that I can track my spending trends over time.

#### Acceptance Criteria

1. THE Monthly_Summary SHALL group all transactions by calendar month and year, displaying each group under a heading in the format "Month YYYY" (e.g., "November 2026").
2. THE Monthly_Summary SHALL display the total amount spent per month, formatted as a currency value with two decimal places and a currency symbol (e.g., $0.00).
3. THE Monthly_Summary SHALL display the number of transactions per month.
4. THE Monthly_Summary SHALL list each month in reverse-chronological order (most recent first).
5. WHEN no transactions exist, THE Monthly_Summary SHALL display an empty-state message indicating no data is available.
6. WHEN the user navigates to the Monthly_Summary view, THE App SHALL display it without a page reload.

---

### Requirement 10: Performance and Usability

**User Story:** As a user, I want the app to feel fast and easy to use, so that recording expenses does not interrupt my day.

#### Acceptance Criteria

1. THE App SHALL render its initial UI within 2 seconds when loaded over a 10 Mbps connection.
2. WHEN the user performs any interaction (add, delete, theme toggle, view switch), THE App SHALL reflect the result within 100 milliseconds.
3. THE App SHALL ensure that every primary function (add transaction, delete transaction, view chart, view summary, toggle theme) is reachable within 2 user interactions from the initial loaded state.
4. THE App SHALL use readable font sizes (minimum 14px for body text) throughout all views.
5. THE App SHALL be fully usable on viewport widths from 320px to 1920px without horizontal scrolling.
