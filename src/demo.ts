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
  console.log(`\n${BOLD}${BLUE}[Step ${n}]${RESET} ${BOLD}${text}${RESET}`);
}

function ok(text: string) { console.log(`  ${GREEN}✓${RESET} ${text}`); }
function info(text: string) { console.log(`  ${YELLOW}→${RESET} ${text}`); }
function dim(text: string) { console.log(`  ${DIM}${text}${RESET}`); }

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

function printAuditLog(events: any[]) {
  console.log(`\n  ${BOLD}${DIM}── Audit Trail ──────────────────────────────${RESET}`);
  events.forEach(e => {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    console.log(`  ${DIM}${ts}${RESET}  ${CYAN}${e.action.padEnd(28)}${RESET}  ${DIM}${e.description}${RESET}`);
  });
}

// ─── Demo ─────────────────────────────────────────────────────────────────────
async function runDemo() {
  header('Real Estate Transaction Automation — Full Lifecycle Demo');
  console.log(`\n${DIM}  Scenario: Anna (seller) and Matti (buyer) have agreed on a property.${RESET}`);
  console.log(`${DIM}  This demo walks through every automated step that follows.${RESET}`);

  const service = new TransactionService();

  // ── Parties & Property ─────────────────────────────────────────────────────
  const property = {
    id: 'prop-001',
    address: 'Mannerheimintie 12, Helsinki',
    price: 350_000,
    squareMeters: 85,
    description: '3-bedroom apartment, city centre',
  };
  const seller = {
    id: 'seller-001', name: 'Anna Virtanen',
    email: 'anna@example.com', phoneNumber: '+358401234567', role: 'SELLER' as const,
  };
  const buyer = {
    id: 'buyer-001', name: 'Matti Korhonen',
    email: 'matti@example.com', phoneNumber: '+358409876543', role: 'BUYER' as const,
  };
  const notary = { id: 'notary-001', name: 'Liisa Mäkinen (Notary)' };

  // ── Step 1: Initiate ───────────────────────────────────────────────────────
  step(1, 'Initiating transaction');
  const tx = service.initiateTransaction(property, seller, buyer);
  ok(`Transaction created: ${BOLD}${tx.id}${RESET}`);
  info(`Property: ${property.address} — €${property.price.toLocaleString()}`);
  info(`Seller: ${seller.name}  |  Buyer: ${buyer.name}`);
  printStatus('Status', tx.status);

  // ── Step 2: Open Escrow ────────────────────────────────────────────────────
  step(2, 'Opening escrow account');
  const escrow = service.openEscrow(tx.id, 'SYSTEM');
  ok(`Escrow account opened: ${escrow.id}`);
  dim('Funds will be held in escrow until ownership transfer is complete.');

  // ── Step 3: Upload Documents ───────────────────────────────────────────────
  step(3, 'Uploading required documents');
  const docsToUpload = [
    { type: DocumentType.TITLE_DEED, by: seller.id, label: 'Title Deed' },
    { type: DocumentType.IDENTITY_SELLER, by: seller.id, label: 'Seller Identity' },
    { type: DocumentType.IDENTITY_BUYER, by: buyer.id, label: 'Buyer Identity' },
    { type: DocumentType.PURCHASE_AGREEMENT, by: seller.id, label: 'Purchase Agreement' },
  ];

  const uploadedDocs = docsToUpload.map(d => {
    const doc = service.uploadDocument(tx.id, d.type, d.by);
    ok(`${d.label.padEnd(22)} uploaded  (id: ${doc.id.slice(0, 8)}…)`);
    return doc;
  });
  printStatus('Status', service.getTransaction(tx.id).status);

  // ── Step 4: Verify Documents ───────────────────────────────────────────────
  step(4, 'Notary verifies all documents');
  uploadedDocs.forEach((doc, i) => {
    service.verifyDocument(tx.id, doc.id, notary.id);
    ok(`${docsToUpload[i].label.padEnd(22)} verified  by ${notary.name}`);
  });
  printStatus('Status', service.getTransaction(tx.id).status);

  // ── Step 5: Process Payment via Escrow ────────────────────────────────────
  step(5, 'Buyer submits payment via escrow');
  const payment = service.processPayment(
    tx.id, 350_000, buyer.id, PaymentMethod.ESCROW, 'FI-BANK-2024-88421',
  );
  ok(`Payment of €${payment.amount.toLocaleString()} submitted`);
  info(`Method: ${payment.method}  |  Reference: ${payment.reference}`);
  printStatus('Status', service.getTransaction(tx.id).status);

  // ── Step 6: Bank Confirms Payment ─────────────────────────────────────────
  step(6, 'Bank confirms payment receipt');
  service.confirmPayment(tx.id, payment.id, 'BANK_SYSTEM');
  ok('Payment confirmed by bank');
  printStatus('Status', service.getTransaction(tx.id).status);

  // ── Step 7: Complete Ownership Transfer ───────────────────────────────────
  step(7, 'Notary completes ownership transfer');
  service.completeOwnershipTransfer(tx.id, notary.id);
  const completed = service.getTransaction(tx.id);
  ok(`Ownership of "${property.address}" transferred`);
  ok(`From: ${BOLD}${seller.name}${RESET}  →  To: ${BOLD}${buyer.name}${RESET}`);
  ok(`Escrow funds released to seller`);
  printStatus('Status', completed.status);
  info(`Completed at: ${completed.completedAt?.toISOString()}`);

  // ── Audit Log ──────────────────────────────────────────────────────────────
  header('Full Audit Trail');
  printAuditLog(service.getAuditLog(tx.id));

  // ── Summary ────────────────────────────────────────────────────────────────
  header('Transaction Summary');
  console.log(`\n  ${BOLD}Property:${RESET}   ${property.address}`);
  console.log(`  ${BOLD}Price:${RESET}       €${property.price.toLocaleString()}`);
  console.log(`  ${BOLD}Seller:${RESET}      ${seller.name}`);
  console.log(`  ${BOLD}Buyer:${RESET}       ${buyer.name}`);
  console.log(`  ${BOLD}Notary:${RESET}      ${notary.name}`);
  console.log(`  ${BOLD}Documents:${RESET}   ${completed.documents.length} verified`);
  console.log(`  ${BOLD}Payments:${RESET}    €${completed.payments.reduce((s, p) => s + p.amount, 0).toLocaleString()} confirmed`);
  console.log(`  ${BOLD}Final Status:${RESET} ${statusBadge(completed.status)}`);
  console.log(`\n${BOLD}${GREEN}  ✓ Transaction complete. All steps automated successfully.${RESET}\n`);

  // ── Bonus: Demonstrate state guard ────────────────────────────────────────
  header('State Machine Guard Demo (Error Handling)');
  console.log(`\n${DIM}  Attempting to process a payment on a COMPLETED transaction…${RESET}`);
  try {
    service.processPayment(tx.id, 1000, buyer.id, PaymentMethod.BANK_TRANSFER, 'BAD-REF');
  } catch (e: any) {
    console.log(`  ${RED}✗ Correctly rejected:${RESET} ${e.message}`);
  }
  console.log(`\n${DIM}  The state machine prevents invalid transitions at runtime.${RESET}\n`);
}

runDemo().catch(console.error);
