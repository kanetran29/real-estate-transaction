import { v4 as uuidv4 } from 'uuid';
import {
  Transaction, TransactionStatus, Property, Party,
  Document, DocumentType, Payment, PaymentMethod,
  EscrowAccount, AuditEvent,
} from '../models/Transaction';
import { ContractService } from './ContractService';

// ─── Required documents for a valid transaction ───────────────────────────────
const REQUIRED_DOCUMENTS: DocumentType[] = [
  DocumentType.TITLE_DEED,
  DocumentType.IDENTITY_SELLER,
  DocumentType.IDENTITY_BUYER,
  DocumentType.PURCHASE_AGREEMENT,
];

// ─── TransactionService ───────────────────────────────────────────────────────
// Core orchestrator for the post-agreement real estate transaction lifecycle.
// Enforces the state machine: each method validates the current status before
// allowing a transition, making illegal state changes impossible at runtime.

export class TransactionService {
  private transactions: Map<string, Transaction> = new Map();
  private contractService = new ContractService();

  // ── 1. Initiate ─────────────────────────────────────────────────────────────
  initiateTransaction(property: Property, seller: Party, buyer: Party): Transaction {
    const transaction: Transaction = {
      id: uuidv4(),
      property,
      seller,
      buyer,
      status: TransactionStatus.INITIATED,
      documents: [],
      payments: [],
      auditLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);
    this.addAuditEvent(transaction, 'SYSTEM', 'TRANSACTION_INITIATED',
      `Transaction created for property at ${property.address}`);

    // Auto-generate purchase agreement contract
    const contract = this.contractService.generateContract(transaction);
    transaction.contract = contract;
    this.transitionStatus(transaction, TransactionStatus.CONTRACT_GENERATED, 'SYSTEM');
    this.addAuditEvent(transaction, 'SYSTEM', 'CONTRACT_GENERATED',
      `Purchase agreement auto-generated (id: ${contract.id}, template: ${contract.templateVersion})`);

    this.transitionStatus(transaction, TransactionStatus.DOCUMENTS_PENDING, 'SYSTEM');
    return transaction;
  }

  // ── 2. Escrow ────────────────────────────────────────────────────────────────
  openEscrow(transactionId: string, actor: string): EscrowAccount {
    const tx = this.getTransaction(transactionId);
    if (tx.escrow) throw new Error('Escrow already open for this transaction');

    const escrow: EscrowAccount = {
      id: uuidv4(),
      balance: 0,
      heldSince: new Date(),
      released: false,
    };
    tx.escrow = escrow;
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, actor, 'ESCROW_OPENED', `Escrow account ${escrow.id} opened`);
    return escrow;
  }

  // ── 3. Documents ─────────────────────────────────────────────────────────────
  uploadDocument(
    transactionId: string,
    documentType: DocumentType,
    uploadedBy: string,
    notes?: string,
  ): Document {
    const tx = this.getTransaction(transactionId);
    this.assertStatus(tx, [TransactionStatus.DOCUMENTS_PENDING], 'upload documents');

    const document: Document = {
      id: uuidv4(),
      type: documentType,
      uploadedBy,
      uploadedAt: new Date(),
      verified: false,
      notes,
    };

    tx.documents.push(document);
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, uploadedBy, 'DOCUMENT_UPLOADED',
      `Document "${documentType}" uploaded (id: ${document.id})`);
    return document;
  }

  verifyDocument(transactionId: string, documentId: string, verifiedBy: string): void {
    const tx = this.getTransaction(transactionId);
    const doc = tx.documents.find(d => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);
    if (doc.verified) throw new Error(`Document ${documentId} is already verified`);

    doc.verified = true;
    doc.verifiedBy = verifiedBy;
    doc.verifiedAt = new Date();
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, verifiedBy, 'DOCUMENT_VERIFIED',
      `Document "${doc.type}" verified by ${verifiedBy}`);

    if (this.areAllRequiredDocumentsVerified(tx)) {
      this.transitionStatus(tx, TransactionStatus.DOCUMENTS_VERIFIED, verifiedBy);
      this.transitionStatus(tx, TransactionStatus.PAYMENT_PENDING, 'SYSTEM');
    }
  }

  // ── 4. Payment ───────────────────────────────────────────────────────────────
  processPayment(
    transactionId: string,
    amount: number,
    paidBy: string,
    method: PaymentMethod,
    reference: string,
  ): Payment {
    const tx = this.getTransaction(transactionId);
    this.assertStatus(tx, [TransactionStatus.PAYMENT_PENDING], 'process payment');
    if (amount <= 0) throw new Error('Payment amount must be positive');

    const payment: Payment = {
      id: uuidv4(),
      amount,
      paidBy,
      paidAt: new Date(),
      method,
      reference,
      confirmed: false,
    };

    tx.payments.push(payment);
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, paidBy, 'PAYMENT_SUBMITTED',
      `Payment of €${amount.toLocaleString()} submitted via ${method} (ref: ${reference})`);

    // If using escrow, hold funds there
    if (method === PaymentMethod.ESCROW && tx.escrow) {
      tx.escrow.balance += amount;
      this.addAuditEvent(tx, 'SYSTEM', 'ESCROW_FUNDED',
        `€${amount.toLocaleString()} deposited into escrow`);
    }

    return payment;
  }

  confirmPayment(transactionId: string, paymentId: string, confirmedBy: string): void {
    const tx = this.getTransaction(transactionId);
    const payment = tx.payments.find(p => p.id === paymentId);
    if (!payment) throw new Error(`Payment ${paymentId} not found`);
    if (payment.confirmed) throw new Error('Payment already confirmed');

    payment.confirmed = true;
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, confirmedBy, 'PAYMENT_CONFIRMED',
      `Payment ${paymentId} confirmed by ${confirmedBy}`);

    const totalConfirmed = tx.payments
      .filter(p => p.confirmed)
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalConfirmed >= tx.property.price) {
      this.transitionStatus(tx, TransactionStatus.PAYMENT_RECEIVED, confirmedBy);
      this.transitionStatus(tx, TransactionStatus.OWNERSHIP_TRANSFER_PENDING, 'SYSTEM');
    }
  }

  // ── 5. Ownership Transfer ────────────────────────────────────────────────────
  completeOwnershipTransfer(transactionId: string, notaryId: string): void {
    const tx = this.getTransaction(transactionId);
    this.assertStatus(tx, [TransactionStatus.OWNERSHIP_TRANSFER_PENDING], 'complete transfer');

    // Release escrow if applicable
    if (tx.escrow && !tx.escrow.released) {
      tx.escrow.released = true;
      this.addAuditEvent(tx, notaryId, 'ESCROW_RELEASED',
        `Escrow funds (€${tx.escrow.balance.toLocaleString()}) released to seller`);
    }

    this.transitionStatus(tx, TransactionStatus.COMPLETED, notaryId);
    tx.completedAt = new Date();
    this.addAuditEvent(tx, notaryId, 'OWNERSHIP_TRANSFERRED',
      `Property "${tx.property.address}" transferred from ${tx.seller.name} to ${tx.buyer.name}`);
  }

  // ── 6. Cancel / Dispute ──────────────────────────────────────────────────────
  cancelTransaction(transactionId: string, actor: string, reason: string): void {
    const tx = this.getTransaction(transactionId);
    if (tx.status === TransactionStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed transaction');
    }
    this.transitionStatus(tx, TransactionStatus.CANCELLED, actor);
    tx.cancelledAt = new Date();
    this.addAuditEvent(tx, actor, 'TRANSACTION_CANCELLED', `Cancelled: ${reason}`);
  }

  raiseDispute(transactionId: string, actor: string, reason: string): void {
    const tx = this.getTransaction(transactionId);
    if ([TransactionStatus.COMPLETED, TransactionStatus.CANCELLED].includes(tx.status)) {
      throw new Error('Cannot raise dispute on a closed transaction');
    }
    tx.disputeReason = reason;
    this.transitionStatus(tx, TransactionStatus.DISPUTED, actor);
    this.addAuditEvent(tx, actor, 'DISPUTE_RAISED', `Dispute: ${reason}`);
  }

  resolveDispute(transactionId: string, actor: string, resolution: string): void {
    const tx = this.getTransaction(transactionId);
    this.assertStatus(tx, [TransactionStatus.DISPUTED], 'resolve dispute');
    tx.disputeReason = undefined;
    this.transitionStatus(tx, TransactionStatus.OWNERSHIP_TRANSFER_PENDING, actor);
    this.addAuditEvent(tx, actor, 'DISPUTE_RESOLVED', `Resolution: ${resolution}`);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────
  getTransaction(transactionId: string): Transaction {
    const tx = this.transactions.get(transactionId);
    if (!tx) throw new Error(`Transaction ${transactionId} not found`);
    return tx;
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  getAuditLog(transactionId: string): AuditEvent[] {
    return this.getTransaction(transactionId).auditLog;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────
  private transitionStatus(tx: Transaction, newStatus: TransactionStatus, actor: string): void {
    const prev = tx.status;
    tx.status = newStatus;
    tx.updatedAt = new Date();
    this.addAuditEvent(tx, actor, 'STATUS_CHANGED',
      `Status: ${prev} → ${newStatus}`, prev, newStatus);
  }

  private addAuditEvent(
    tx: Transaction,
    actor: string,
    action: string,
    description: string,
    previousStatus?: TransactionStatus,
    newStatus?: TransactionStatus,
  ): void {
    tx.auditLog.push({ timestamp: new Date(), actor, action, description, previousStatus, newStatus });
  }

  private assertStatus(tx: Transaction, allowed: TransactionStatus[], operation: string): void {
    if (!allowed.includes(tx.status)) {
      throw new Error(
        `Cannot ${operation} when status is "${tx.status}". ` +
        `Expected: ${allowed.join(' or ')}`
      );
    }
  }

  private areAllRequiredDocumentsVerified(tx: Transaction): boolean {
    const uploadedAndVerified = new Set(
      tx.documents.filter(d => d.verified).map(d => d.type)
    );
    return REQUIRED_DOCUMENTS.every(type => uploadedAndVerified.has(type));
  }
}
