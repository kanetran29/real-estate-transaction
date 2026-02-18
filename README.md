# real-estate-transaction

A TypeScript demo of an automated real estate transaction engine. It models the post-agreement lifecycle — from document collection through escrow, payment, and ownership transfer — using a strict state machine.

## How it works

Every transaction moves through a fixed sequence of states:

```
INITIATED → CONTRACT_GENERATED → DOCUMENTS_PENDING → DOCUMENTS_VERIFIED → PAYMENT_PENDING → PAYMENT_RECEIVED → OWNERSHIP_TRANSFER_PENDING → COMPLETED
```

The service layer enforces this — any operation attempted out of order throws immediately. Transactions can also branch into `CANCELLED` or `DISPUTED` states, with dispute resolution returning to `OWNERSHIP_TRANSFER_PENDING`.

## System overview

```mermaid
graph LR
    User((Buyer / Seller))
    Gateway[API Gateway]
    Engine[Workflow Engine\nState Machine]
    DB[(Audit Ledger)]

    Identity[Identity API\nOnfido / SumSub]
    Sign[E-Sign API\nDocuSign]
    Bank[Banking API\nStripe Treasury]
    Gov[Registry API\nSimplifile]

    User --> Gateway --> Engine --> DB
    Engine -->|KYC check| Identity
    Engine -->|Sign contract| Sign
    Engine -->|Create escrow| Bank
    Engine -->|Record deed| Gov
```

## Contract generation & document verification

```mermaid
sequenceDiagram
    actor Seller
    actor Buyer
    participant Engine as Workflow Engine
    participant AI as AI Notary Agent

    Note over Engine: State: INITIATED

    Engine->>Engine: Auto-generate purchase agreement
    Note right of Engine: Template v2.1-AI fills in property,<br/>party names, price, and date
    Engine->>Engine: State → CONTRACT_GENERATED
    Engine->>Engine: State → DOCUMENTS_PENDING

    Seller->>Engine: Upload Title Deed + Identity
    Buyer->>Engine: Upload Identity
    Seller->>Engine: Upload Purchase Agreement

    Engine->>AI: Trigger document analysis
    AI->>AI: Score each doc (confidence 0.00-1.00)
    AI-->>Engine: verifyDocument() per passing doc

    Note over Engine: All required docs verified
    Engine->>Engine: State → DOCUMENTS_VERIFIED
    Engine->>Engine: State → PAYMENT_PENDING
```

## Payment & escrow settlement

```mermaid
sequenceDiagram
    actor Buyer
    participant Engine as Workflow Engine
    participant Bank as Banking API
    actor Seller

    Note over Engine: State: PAYMENT_PENDING

    Engine->>Bank: Create virtual IBAN for this transaction
    Bank-->>Engine: IBAN confirmed

    Buyer->>Bank: Wire full purchase amount to IBAN
    Bank-->>Engine: Webhook: FUNDS_RECEIVED
    Engine->>Engine: Assert amount == contract price
    Engine->>Engine: State → PAYMENT_RECEIVED
    Engine->>Engine: State → OWNERSHIP_TRANSFER_PENDING

    Note over Engine: Notary records deed

    Engine->>Bank: Release escrow funds
    Bank->>Seller: Payout (net proceeds)
    Engine->>Engine: State → COMPLETED
```

## Run the demo

```bash
npm install
npm run demo
```

The demo covers four scenarios:

| Scenario         | What it shows                                                 |
| ---------------- | ------------------------------------------------------------- |
| Happy path       | Full lifecycle from initiation to completed transfer          |
| Cancellation     | Mid-process cancellation and blocked follow-up operations     |
| Dispute          | Raising and resolving a dispute, then completing the transfer |
| Edge-case guards | Invalid operations rejected by the state machine              |

## Project structure

```
src/
  models/Transaction.ts      # Domain types and enums
  services/TransactionService.ts  # State machine + business logic
  demo.ts                    # CLI demo runner
  index.ts                   # Express API entry point
```
