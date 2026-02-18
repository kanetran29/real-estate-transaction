import { TransactionService } from './services/TransactionService';
import { DocumentType, PaymentMethod } from './models/Transaction';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const WHITE = '\x1b[37m';

function header(text: string) {
  const line = '─'.repeat(60);
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${WHITE}  ${text}${RESET}`);
  console.log(`${BOLD}${CYAN}${line}${RESET}`);
}

function step(n: number, text: string) {
  console.log(`\n${BOLD}${BLUE} [Step ${n}]${RESET} ${BOLD}${text}${RESET}`);
}

function ok(text: string) { console.log(`  ${GREEN}✓${RESET} ${text}`); }
function info(text: string) { console.log(`  ${YELLOW}→${RESET} ${text}`); }
function dim(text: string) { console.log(`  ${DIM}${text}${RESET}`); }
function guard(text: string) { console.log(`  ${RED}✗ Correctly rejected:${RESET} ${text}`); }

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    INITIATED: CYAN,
    DOCUMENTS_PENDING: YELLOW,
    DOCUMENTS_VERIFIED: GREEN,
    PAYMENT_PENDING: YELLOW,
    PAYMENT_RECEIVED: GREEN,
    OWNERSHIP_TRANSFER_PENDING: MAGENTA,
    COMPLETED: GREEN,
    CANCELLED: RED,
    DISPUTED: RED,
  };
  const color = colors[status] ?? WHITE;
  return `${BOLD}${color}[${status}]${RESET}`;
}

function printStatus(label: string, status: string) {
  console.log(`  ${DIM}${label}:${RESET} ${statusBadge(status)}`);
}

function printAuditLog(events: Array<{ timestamp: Date; actor: string; action: string; description: string }>) {
  console.log(`\n  ${BOLD}${DIM}── Audit Trail ──────────────────────────────${RESET}`);
  if (events.length === 0) {
    console.log(`  ${DIM}No audit events recorded for this transaction.${RESET}`);
    return;
  }
  events.forEach(e => {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    console.log(`  ${DIM}${ts}${RESET}  ${CYAN}${e.action.padEnd(28)}${RESET}  ${DIM}${e.description}${RESET}`);
  });
}

// ─── Demo ─────────────────────────────────────────────────────────────────────
async function runDemo() {
  const property1 = {
    id: 'prop-001', address: 'Mannerheimintie 12, Helsinki', price: 350_000,
    squareMeters: 85, description: '3-bedroom apartment, city centre',
  };
  const property2 = {
    id: 'prop-002', address: 'Erottajankatu 5, Espoo', price: 280_000,
    squareMeters: 70, description: '2-bedroom apartment, quiet neighborhood',
  };
  const property3 = {
    id: 'prop-003', address: 'Bulevardi 10, Vantaa', price: 420_000,
    squareMeters: 100, description: '4-bedroom house, family-friendly',
  };

  const seller = {
    id: 'seller-001', name: 'Anna Virtanen', email: 'anna@example.com',
    phoneNumber: '+358401234567', role: 'SELLER' as const,
  };
  const buyer = {
    id: 'buyer-001', name: 'Matti Korhonen', email: 'matti@example.com',
    phoneNumber: '+358409876543', role: 'BUYER' as const,
  };
  const notary = { id: 'notary-001', name: 'Liisa Mäkinen (Notary)' };
  const bank = { id: 'bank-001', name: 'Nordea Bank' };
  const system = { id: 'system-001', name: 'Automated System' };

  // ── Scenario 1: Happy Path ──────────────────────────────────────────────────
  header('Scenario 1: Happy Path — Full Lifecycle Demo');
  console.log(`\n${DIM}  Scenario: Anna (seller) and Matti (buyer) agree on property 1.${RESET}`);
  console.log(`${DIM}  This demo walks through every automated step to completion.${RESET}`);

  const service1 = new TransactionService();
  let stepCounter = 1;

  // Step 1: Initiate
  step(stepCounter++, 'Initiating transaction');
  const tx1 = service1.initiateTransaction(property1, seller, buyer);
  ok(`Transaction created: ${BOLD}${tx1.id}${RESET}`);
  info(`Property: ${property1.address} — €${property1.price.toLocaleString()}`);
  info(`Seller: ${seller.name}  | Buyer: ${buyer.name}`);
  printStatus('Status', tx1.status);

  // Step 2: Open Escrow
  step(stepCounter++, 'Opening escrow account');
  const escrow1 = service1.openEscrow(tx1.id, system.id);
  ok(`Escrow account opened: ${escrow1.id}`);
  dim('Funds will be held in escrow until ownership transfer is complete.');
  printStatus('Status', service1.getTransaction(tx1.id).status);

  // Step 3: Upload Documents
  step(stepCounter++, 'Uploading required documents');
  const docsToUpload1 = [
    { type: DocumentType.TITLE_DEED, by: seller.id, label: 'Title Deed' },
    { type: DocumentType.IDENTITY_SELLER, by: seller.id, label: 'Seller Identity' },
    { type: DocumentType.IDENTITY_BUYER, by: buyer.id, label: 'Buyer Identity' },
    { type: DocumentType.PURCHASE_AGREEMENT, by: seller.id, label: 'Purchase Agreement' },
  ];

  const uploadedDocs1 = docsToUpload1.map(d => {
    const doc = service1.uploadDocument(tx1.id, d.type, d.by);
    ok(`${d.label.padEnd(22)} uploaded (id: ${doc.id.slice(0, 8)}…)`);
    return doc;
  });
  printStatus('Status', service1.getTransaction(tx1.id).status);

  // Step 4: Verify Documents
  step(stepCounter++, 'Notary verifies all documents');
  uploadedDocs1.forEach((doc, i) => {
    service1.verifyDocument(tx1.id, doc.id, notary.id);
    ok(`${docsToUpload1[i].label.padEnd(22)} verified by ${notary.name}`);
  });
  printStatus('Status', service1.getTransaction(tx1.id).status);

  // Step 5: Process Payment via Escrow
  step(stepCounter++, 'Buyer submits payment via escrow');
  const payment1 = service1.processPayment(
    tx1.id, property1.price, buyer.id, PaymentMethod.ESCROW, 'FI-BANK-2024-88421',
  );
  ok(`Payment of €${payment1.amount.toLocaleString()} submitted`);
  info(`Method: ${payment1.method}  | Reference: ${payment1.reference}`);
  printStatus('Status', service1.getTransaction(tx1.id).status);

  // Step 6: Bank Confirms Payment
  step(stepCounter++, 'Bank confirms payment receipt');
  service1.confirmPayment(tx1.id, payment1.id, bank.id);
  ok('Payment confirmed by bank');
  printStatus('Status', service1.getTransaction(tx1.id).status);

  // Step 7: Complete Ownership Transfer
  step(stepCounter++, 'Notary completes ownership transfer');
  service1.completeOwnershipTransfer(tx1.id, notary.id);
  const completedTx1 = service1.getTransaction(tx1.id);
  ok(`Ownership of "${property1.address}" transferred`);
  ok(`From: ${BOLD}${seller.name}${RESET}  →  To: ${BOLD}${buyer.name}${RESET}`);
  ok('Escrow funds released to seller');
  printStatus('Status', completedTx1.status);
  info(`Completed at: ${completedTx1.completedAt?.toISOString()}`);

  header('Audit Trail for Happy Path');
  printAuditLog(service1.getAuditLog(tx1.id));

  header('Summary for Happy Path');
  console.log(`\n  ${BOLD}Property:${RESET}    ${property1.address}`);
  console.log(`  ${BOLD}Price:${RESET}       €${property1.price.toLocaleString()}`);
  console.log(`  ${BOLD}Seller:${RESET}      ${seller.name}`);
  console.log(`  ${BOLD}Buyer:${RESET}       ${buyer.name}`);
  console.log(`  ${BOLD}Notary:${RESET}      ${notary.name}`);
  console.log(`  ${BOLD}Documents:${RESET}   ${completedTx1.documents.length} verified`);
  console.log(`  ${BOLD}Payments:${RESET}    €${completedTx1.payments.reduce((s, p) => s + p.amount, 0).toLocaleString()} confirmed`);
  console.log(`  ${BOLD}Final Status:${RESET} ${statusBadge(completedTx1.status)}`);
  console.log(`\n${BOLD}${GREEN}  ✓ Transaction complete. All steps automated successfully.${RESET}\n`);


  // ── Scenario 2: Cancellation ────────────────────────────────────────────────
  header('Scenario 2: Cancellation — Transaction Cancelled Mid-Process');
  console.log(`\n${DIM}  Scenario: Buyer decides to cancel after documents are uploaded for property 2.${RESET}`);

  const service2 = new TransactionService();
  stepCounter = 1;

  step(stepCounter++, 'Initiating transaction');
  const tx2 = service2.initiateTransaction(property2, seller, buyer);
  ok(`Transaction created: ${BOLD}${tx2.id}${RESET}`);
  printStatus('Status', tx2.status);

  step(stepCounter++, 'Opening escrow account');
  service2.openEscrow(tx2.id, system.id);
  ok('Escrow account opened.');
  printStatus('Status', service2.getTransaction(tx2.id).status);

  step(stepCounter++, 'Uploading some documents');
  const doc2a = service2.uploadDocument(tx2.id, DocumentType.TITLE_DEED, seller.id);
  service2.uploadDocument(tx2.id, DocumentType.IDENTITY_BUYER, buyer.id);
  ok('Documents uploaded.');
  printStatus('Status', service2.getTransaction(tx2.id).status);

  step(stepCounter++, 'Buyer cancels the transaction');
  service2.cancelTransaction(tx2.id, buyer.id, 'Buyer changed mind');
  ok('Transaction cancelled.');
  printStatus('Status', service2.getTransaction(tx2.id).status);

  step(stepCounter++, 'Attempting to verify documents on a cancelled transaction');
  try {
    service2.verifyDocument(tx2.id, doc2a.id, notary.id);
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  header('Audit Trail for Cancellation Scenario');
  printAuditLog(service2.getAuditLog(tx2.id));
  console.log(`\n${BOLD}${GREEN}  ✓ Cancellation scenario demonstrated.${RESET}\n`);


  // ── Scenario 3: Dispute ─────────────────────────────────────────────────────
  header('Scenario 3: Dispute — Payment Received, then Disputed');
  console.log(`\n${DIM}  Scenario: Seller disputes payment after it's confirmed for property 3.${RESET}`);

  const service3 = new TransactionService();
  stepCounter = 1;

  step(stepCounter++, 'Setting up transaction through to payment confirmed');
  const tx3 = service3.initiateTransaction(property3, seller, buyer);
  service3.openEscrow(tx3.id, system.id);
  const docsToUpload3 = [
    { type: DocumentType.TITLE_DEED, by: seller.id },
    { type: DocumentType.IDENTITY_SELLER, by: seller.id },
    { type: DocumentType.IDENTITY_BUYER, by: buyer.id },
    { type: DocumentType.PURCHASE_AGREEMENT, by: seller.id },
  ];
  const uploadedDocs3 = docsToUpload3.map(d => service3.uploadDocument(tx3.id, d.type, d.by));
  uploadedDocs3.forEach(doc => service3.verifyDocument(tx3.id, doc.id, notary.id));
  const payment3 = service3.processPayment(tx3.id, property3.price, buyer.id, PaymentMethod.ESCROW, 'FI-BANK-2024-99876');
  service3.confirmPayment(tx3.id, payment3.id, bank.id);
  ok(`Transaction reached ${statusBadge(service3.getTransaction(tx3.id).status)}`);

  step(stepCounter++, 'Seller raises a dispute');
  service3.raiseDispute(tx3.id, seller.id, 'Payment amount seems incorrect.');
  ok('Dispute raised by seller.');
  printStatus('Status', service3.getTransaction(tx3.id).status);

  step(stepCounter++, 'Attempting to complete ownership transfer while disputed');
  try {
    service3.completeOwnershipTransfer(tx3.id, notary.id);
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  step(stepCounter++, 'Resolving the dispute (investigation confirms payment is correct)');
  service3.resolveDispute(tx3.id, system.id, 'Investigation confirmed payment is correct. Proceeding to ownership transfer.');
  ok('Dispute resolved.');
  printStatus('Status', service3.getTransaction(tx3.id).status);

  step(stepCounter++, 'Notary completes ownership transfer (after dispute resolution)');
  service3.completeOwnershipTransfer(tx3.id, notary.id);
  ok('Ownership transfer completed.');
  printStatus('Status', service3.getTransaction(tx3.id).status);

  header('Audit Trail for Dispute Scenario');
  printAuditLog(service3.getAuditLog(tx3.id));
  console.log(`\n${BOLD}${GREEN}  ✓ Dispute scenario demonstrated.${RESET}\n`);


  // ── Scenario 4: Edge-Case Guards ────────────────────────────────────────────
  header('Scenario 4: Edge-Case Guards — Invalid Operations');
  console.log(`\n${DIM}  Demonstrating how the state machine prevents invalid actions.${RESET}`);

  const service4 = new TransactionService();
  stepCounter = 1;

  step(stepCounter++, 'Setting up a transaction for guard testing');
  const tx4 = service4.initiateTransaction(property1, seller, buyer);
  service4.openEscrow(tx4.id, system.id);
  const doc4a = service4.uploadDocument(tx4.id, DocumentType.TITLE_DEED, seller.id);
  service4.uploadDocument(tx4.id, DocumentType.IDENTITY_SELLER, seller.id);
  service4.uploadDocument(tx4.id, DocumentType.IDENTITY_BUYER, buyer.id);
  service4.uploadDocument(tx4.id, DocumentType.PURCHASE_AGREEMENT, seller.id);
  service4.verifyDocument(tx4.id, doc4a.id, notary.id);
  ok(`Transaction is in ${statusBadge(service4.getTransaction(tx4.id).status)}`);

  // Guard 1: Duplicate document verification
  step(stepCounter++, 'Guard 1 — Attempting to verify an already-verified document');
  try {
    service4.verifyDocument(tx4.id, doc4a.id, notary.id);
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  // Verify remaining docs to reach PAYMENT_PENDING
  const tx4Docs = service4.getTransaction(tx4.id).documents;
  tx4Docs.filter(d => !d.verified).forEach(d => service4.verifyDocument(tx4.id, d.id, notary.id));
  ok(`All docs verified — now in ${statusBadge(service4.getTransaction(tx4.id).status)}`);

  // Guard 2: Wrong payment amount (negative / zero)
  step(stepCounter++, 'Guard 2 — Attempting to process a payment with amount ≤ 0');
  try {
    service4.processPayment(tx4.id, -500, buyer.id, PaymentMethod.ESCROW, 'BAD-REF-1');
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  // Guard 3: Complete ownership before payment confirmed
  step(stepCounter++, 'Guard 3 — Attempting to complete ownership transfer before payment');
  try {
    service4.completeOwnershipTransfer(tx4.id, notary.id);
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  // Proceed to OWNERSHIP_TRANSFER_PENDING
  const payment4 = service4.processPayment(tx4.id, property1.price, buyer.id, PaymentMethod.ESCROW, 'GOOD-REF-1');
  service4.confirmPayment(tx4.id, payment4.id, bank.id);
  ok(`Payment confirmed — now in ${statusBadge(service4.getTransaction(tx4.id).status)}`);

  // Guard 4: Upload document after payment received
  step(stepCounter++, 'Guard 4 — Attempting to upload a document after payment is received');
  try {
    service4.uploadDocument(tx4.id, DocumentType.INSPECTION_REPORT, seller.id);
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  // Complete the transaction
  service4.completeOwnershipTransfer(tx4.id, notary.id);
  ok(`Transaction completed — now in ${statusBadge(service4.getTransaction(tx4.id).status)}`);

  // Guard 5: Process payment on a COMPLETED transaction
  step(stepCounter++, 'Guard 5 — Attempting to process payment on a COMPLETED transaction');
  try {
    service4.processPayment(tx4.id, 1000, buyer.id, PaymentMethod.BANK_TRANSFER, 'BAD-REF-2');
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  // Guard 6: Cancel a COMPLETED transaction
  step(stepCounter++, 'Guard 6 — Attempting to cancel a COMPLETED transaction');
  try {
    service4.cancelTransaction(tx4.id, buyer.id, 'Trying to cancel after completion');
  } catch (e: unknown) {
    guard((e as Error).message);
  }

  header('Audit Trail for Edge-Case Guards');
  printAuditLog(service4.getAuditLog(tx4.id));
  console.log(`\n${BOLD}${GREEN}  ✓ Edge-case guards demonstrated. The state machine prevents invalid transitions at runtime.${RESET}\n`);

  console.log(`\n${BOLD}${GREEN}  All demo scenarios completed successfully.${RESET}\n`);
}

runDemo().catch(console.error);
