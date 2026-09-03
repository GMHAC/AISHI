# RIZVI FOMS — Phase 8 Audit & Fix Log (2026-08-30)

## Scope: Procurement Management + Inventory & Store Management
Instruction sections 29-32 (Procurement, Fabric Procurement, Accessories Procurement, General
Procurement) and 33-34 (Inventory Management, Store Management).

## Built in this pass (`routes/procurement.js`, `routes/inventory.js`, 7 new tables in `db.js`)
1. **Suppliers** — registration + evaluation score (Supplier Evaluation / Supplier Performance),
   category (fabric/accessories/general).
2. **Purchase Requisition** — department requests an item/quantity, pending→approved/rejected.
3. **RFQ/Quotation/Comparative Statement** — multiple suppliers can quote against one requisition;
   `GET /requisitions/:id/quotations` returns them cheapest-first as the actual comparative
   statement; one can be marked selected.
4. **Purchase Order** — auto-generated PO number, draft→approved→sent→partially_received→received,
   linked back to the requisition it fulfils (which is auto-marked `converted_to_po`).
5. **Item Master** — item code/name/category/unit/barcode/reorder level.
6. **Stock Transactions** — Receive/Issue/Return/Transfer/Adjustment as one append-only ledger;
   **current stock is always computed by summing the ledger, never stored as a separate mutable
   number**, so balance and history can never disagree with each other.
7. **The actual Procurement↔Inventory link**: `POST /api/inventory/receive-po` posts a real stock
   receipt against a PO (supports partial receiving — tracks cumulative received vs PO quantity and
   auto-updates PO status to `partially_received` or `received`).
8. **Stock control, not just bookkeeping**: an `issue` transaction is rejected if it would take
   stock negative — checked against the live computed balance before the insert, not assumed safe.
9. **Dashboard** — items at/below reorder level, and dead stock (positive balance with no `issue`
   movement in 90 days) — both instruction-named concepts (Reorder, Aging/Dead Stock).

## A real design decision, explained
Aging/Dead Stock could have been a separately maintained "last activity" column that gets updated
on every transaction — instead it's derived live from the transaction ledger (`MAX(...issue dates)`
per item). Slightly more expensive to query, but it can never go stale or be forgotten in a future
code change the way a denormalized column could.

## Verification performed
- `node --check` clean.
- `db.exec(\`` / closing `` `); `` count re-verified balanced (49/49) after this phase's edits.
- Cleaned up two small pieces of dead code in `inventory.js` (an unused helper function and an
  unused constant) left over from an earlier draft of the file, caught on re-read before packaging.
- **Full realistic flow run against real SQLite**: create 2 suppliers → requisition → 2 competing
  quotations → select the cheaper one → create PO from it (auto total calculation) → approve →
  receive partially (3,000 of 5,000, status correctly becomes `partially_received`) → receive the
  rest (status correctly becomes `received`) → confirm computed current stock = 5,000 → issue 100
  units against a cutting order (balance-check passes) → run both dashboard queries (reorder,
  dead stock) — every step returned the correct result, including the partial→full PO status
  transition logic and the stock-balance arithmetic.
- No live server boot possible in this sandbox — same standing note as every phase.

## Running total (Phases 1–8)
Image bug fix · CAPA · Risk Register · Checklist NC engine · Universal Audit Engine · Section/
Department Admin roles · passwordless Employee login · Video Conferences · Circular broadcast ·
Buyer Complaint→CAPA · full HRM lifecycle · Production/IE/Planning engine · Procurement (Supplier→
RFQ→PO) · Inventory (Item Master→Stock ledger→Reorder/Dead-stock), with a real Procurement→
Inventory receiving link between them.

## Still not done
1. Frontend wiring — the single largest remaining item across all 8 phases.
2. ISO/IMS document control, Fabric-specific inspection (4-point inspection etc.), Traceability,
   Marketing & Merchandising's remaining pipeline detail beyond the Phase 5 complaint→CAPA link —
   still on the generic `enterprise_events` layer.
3. Master Dashboard role-based views (MD/GM Production/GM HR/Department Head/Employee).
4. Live `npm install` + boot test + running the seed scripts on a real machine — needed before any
   of Phases 1–8 can actually be used, not just reviewed as code.

Continuing to ISO/IMS document control next.
