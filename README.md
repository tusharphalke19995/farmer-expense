# Farm Ledger

Offline expense tracker for farmers. Amounts are in Indian rupees (₹). Crops, categories, expenses, and sales stay in this browser.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm test
npm run build
```

`npm run build` typechecks, then writes the static site to `dist/`. Preview it with `npm run preview`.

## How the data is stored

IndexedDB database name: `FarmLedger`.

Expense and sale amounts are **integer paise** in the database (₹1 = 100). The repository converts them to rupees for the screens, CSV, and JSON. Totals add paise, so 0.10 + 0.20 stays 0.30.

Acres are the current area of a crop, not a history per season. Cost per acre is spending in the selected date range divided by that area.

Kharif is 1 Jun–31 Oct. Rabi is 1 Nov–31 Mar.

### Schema

- Version 1: `crops`, `categories`, `expenses`, `meta`
- Version 2: adds `incomes`, and sets `acres` to null on crops saved before that

The first time the database is created, it seeds Soybean, Onion, Tractor, Labor, and Other. Later visits do not seed again. Archived items stay on old records and are hidden from the add-expense lists. A crop or category that still has records cannot be deleted; archive it or merge it. Names must be unique, ignoring case and extra spaces.

Screens talk only to `src/data/repository.ts`. Replace that implementation with Supabase or another HTTP API that matches `ExpenseRepository` when you want a server. Leave the UI and hooks as they are.

## Export and import

On **Manage → Backup**:

- **Export JSON** downloads crops, categories, expenses, and sales.
- **Export CSV** downloads every expense with crop and category names. The Expenses screen can also export just the filtered rows.
- **Import JSON** checks the file before anything is written. If the file is valid, confirm to replace the ledger on this phone.

To wipe a test ledger, use the browser’s Application / Storage tools and delete the `FarmLedger` database, then reload.
