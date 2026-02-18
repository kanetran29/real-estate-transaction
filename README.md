# Real Estate Transaction Automation

> **Automated post-agreement real estate transaction system** — from document collection to ownership transfer, with escrow, audit trail, and dispute handling.

## Quick Start

```bash
npm install

# Run the interactive CLI demo (recommended)
npx tsx src/demo.ts

# Run the REST API server
npm run dev   # → http://localhost:3000
```

## Architecture

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design document, including:

- State machine diagram
- Sequence diagram (happy path)
- Component architecture
- Entity-relationship diagram
- Design decisions & production considerations

## Transaction Lifecycle

```
INITIATED → DOCUMENTS_PENDING → DOCUMENTS_VERIFIED → PAYMENT_PENDING
         → PAYMENT_RECEIVED → OWNERSHIP_TRANSFER_PENDING → COMPLETED
```

Each transition is **guarded** — the system rejects any operation that would violate the correct order.

## Required Documents

| Document           | Uploaded By |
| ------------------ | ----------- |
| Title Deed         | Seller      |
| Seller Identity    | Seller      |
| Buyer Identity     | Buyer       |
| Purchase Agreement | Seller      |

## API Endpoints

| Method  | Path                                            | Description          |
| ------- | ----------------------------------------------- | -------------------- |
| `POST`  | `/api/transactions`                             | Initiate transaction |
| `GET`   | `/api/transactions`                             | List all             |
| `GET`   | `/api/transactions/:id`                         | Get transaction      |
| `GET`   | `/api/transactions/:id/audit`                   | Audit log            |
| `POST`  | `/api/transactions/:id/escrow`                  | Open escrow          |
| `POST`  | `/api/transactions/:id/documents`               | Upload document      |
| `PATCH` | `/api/transactions/:id/documents/:docId/verify` | Verify document      |
| `POST`  | `/api/transactions/:id/payments`                | Submit payment       |
| `PATCH` | `/api/transactions/:id/payments/:payId/confirm` | Confirm payment      |
| `POST`  | `/api/transactions/:id/complete`                | Complete transfer    |
| `POST`  | `/api/transactions/:id/cancel`                  | Cancel               |
| `POST`  | `/api/transactions/:id/dispute`                 | Raise dispute        |

## Project Structure

```
real-estate-transaction/
├── src/
│   ├── models/
│   │   └── Transaction.ts        # Domain models & enums
│   ├── services/
│   │   └── TransactionService.ts # State machine & business logic
│   ├── routes/
│   │   └── transactions.ts       # REST API routes
│   ├── index.ts                  # Express server entry point
│   └── demo.ts                   # Colorized CLI walkthrough
├── ARCHITECTURE.md               # Full architecture docs & diagrams
├── package.json
└── tsconfig.json
```

## Key Features

- **State machine** — enforces correct transaction ordering at runtime
- **Escrow** — funds held by neutral party until transfer is complete
- **Audit trail** — every action logged with actor, timestamp, and state transition
- **Dispute handling** — any party can raise a dispute to pause the transaction
- **Type safety** — TypeScript enums prevent invalid document/payment types

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **API**: Express.js
- **IDs**: UUID v4
- **Demo**: Colorized terminal output (no external dependencies)
