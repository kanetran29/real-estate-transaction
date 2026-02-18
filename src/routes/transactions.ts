import { Router, Request, Response } from 'express';
import { TransactionService } from '../services/TransactionService';
import { DocumentType, PaymentMethod } from '../models/Transaction';

export function createTransactionRouter(service: TransactionService): Router {
  const router = Router();

  // POST /api/transactions — Initiate a new transaction
  router.post('/', (req: Request, res: Response) => {
    try {
      const { property, seller, buyer } = req.body;
      const transaction = service.initiateTransaction(property, seller, buyer);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/transactions — List all transactions
  router.get('/', (_req: Request, res: Response) => {
    res.json(service.getAllTransactions());
  });

  // GET /api/transactions/:id — Get a specific transaction
  router.get('/:id', (req: Request, res: Response) => {
    try {
      res.json(service.getTransaction(req.params.id));
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  // GET /api/transactions/:id/audit — Get audit log
  router.get('/:id/audit', (req: Request, res: Response) => {
    try {
      res.json(service.getAuditLog(req.params.id));
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/escrow — Open escrow account
  router.post('/:id/escrow', (req: Request, res: Response) => {
    try {
      const { actor } = req.body;
      const escrow = service.openEscrow(req.params.id, actor ?? 'SYSTEM');
      res.status(201).json(escrow);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/documents — Upload a document
  router.post('/:id/documents', (req: Request, res: Response) => {
    try {
      const { documentType, uploadedBy, notes } = req.body;
      const document = service.uploadDocument(
        req.params.id,
        documentType as DocumentType,
        uploadedBy,
        notes,
      );
      res.status(201).json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/transactions/:id/documents/:documentId/verify — Verify a document
  router.patch('/:id/documents/:documentId/verify', (req: Request, res: Response) => {
    try {
      const { verifiedBy } = req.body;
      service.verifyDocument(req.params.id, req.params.documentId, verifiedBy ?? 'NOTARY');
      res.json({ message: 'Document verified' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/payments — Submit a payment
  router.post('/:id/payments', (req: Request, res: Response) => {
    try {
      const { amount, paidBy, method, reference } = req.body;
      const payment = service.processPayment(
        req.params.id,
        amount,
        paidBy,
        method as PaymentMethod,
        reference ?? uuidRef(),
      );
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PATCH /api/transactions/:id/payments/:paymentId/confirm — Confirm payment
  router.patch('/:id/payments/:paymentId/confirm', (req: Request, res: Response) => {
    try {
      const { confirmedBy } = req.body;
      service.confirmPayment(req.params.id, req.params.paymentId, confirmedBy ?? 'BANK');
      res.json({ message: 'Payment confirmed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/complete — Complete ownership transfer
  router.post('/:id/complete', (req: Request, res: Response) => {
    try {
      const { notaryId } = req.body;
      service.completeOwnershipTransfer(req.params.id, notaryId ?? 'NOTARY');
      res.json({ message: 'Ownership transferred, transaction completed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/cancel — Cancel transaction
  router.post('/:id/cancel', (req: Request, res: Response) => {
    try {
      const { actor, reason } = req.body;
      service.cancelTransaction(req.params.id, actor ?? 'SYSTEM', reason ?? 'No reason provided');
      res.json({ message: 'Transaction cancelled' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/transactions/:id/dispute — Raise a dispute
  router.post('/:id/dispute', (req: Request, res: Response) => {
    try {
      const { actor, reason } = req.body;
      service.raiseDispute(req.params.id, actor, reason);
      res.json({ message: 'Dispute raised' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

function uuidRef(): string {
  return `REF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
