// ─── Domain Models ────────────────────────────────────────────────────────────

export enum TransactionStatus {
  INITIATED = 'INITIATED',
  CONTRACT_GENERATED = 'CONTRACT_GENERATED',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  DOCUMENTS_VERIFIED = 'DOCUMENTS_VERIFIED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  OWNERSHIP_TRANSFER_PENDING = 'OWNERSHIP_TRANSFER_PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum DocumentType {
  TITLE_DEED = 'TITLE_DEED',
  IDENTITY_SELLER = 'IDENTITY_SELLER',
  IDENTITY_BUYER = 'IDENTITY_BUYER',
  PURCHASE_AGREEMENT = 'PURCHASE_AGREEMENT',
  MORTGAGE_APPROVAL = 'MORTGAGE_APPROVAL',
  INSPECTION_REPORT = 'INSPECTION_REPORT',
}

export interface GeneratedContract {
  id: string;
  templateVersion: string;
  generatedAt: Date;
  propertyAddress: string;
  sellerName: string;
  buyerName: string;
  agreedPrice: number;
  content: string;
  signedAt?: Date;
  signedBy?: string;
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  ESCROW = 'ESCROW',
  MORTGAGE = 'MORTGAGE',
}

export interface Property {
  id: string;
  address: string;
  price: number;
  squareMeters: number;
  description?: string;
}

export interface Party {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'SELLER' | 'BUYER' | 'AGENT' | 'NOTARY';
}

export interface Document {
  id: string;
  type: DocumentType;
  uploadedBy: string;
  uploadedAt: Date;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  notes?: string;
}

export interface Payment {
  id: string;
  amount: number;
  paidBy: string;
  paidAt: Date;
  method: PaymentMethod;
  reference: string;
  confirmed: boolean;
}

export interface EscrowAccount {
  id: string;
  balance: number;
  heldSince: Date;
  released: boolean;
}

export interface AuditEvent {
  timestamp: Date;
  actor: string;
  action: string;
  description: string;
  previousStatus?: TransactionStatus;
  newStatus?: TransactionStatus;
}

export interface Transaction {
  id: string;
  property: Property;
  seller: Party;
  buyer: Party;
  status: TransactionStatus;
  documents: Document[];
  payments: Payment[];
  escrow?: EscrowAccount;
  auditLog: AuditEvent[];
  contract?: GeneratedContract;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  disputeReason?: string;
}
