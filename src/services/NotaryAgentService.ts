import { DocumentType } from '../models/Transaction';
import { TransactionService } from './TransactionService';

// Simulates an AI agent that autonomously verifies uploaded documents.
// In production this would call a vision/LLM API (e.g. GPT-4o, Gemini)
// to analyse document images, check for tampering, and score authenticity.

const CONFIDENCE_THRESHOLDS: Record<DocumentType, number> = {
    [DocumentType.TITLE_DEED]: 0.95,
    [DocumentType.IDENTITY_SELLER]: 0.97,
    [DocumentType.IDENTITY_BUYER]: 0.97,
    [DocumentType.PURCHASE_AGREEMENT]: 0.92,
    [DocumentType.MORTGAGE_APPROVAL]: 0.93,
    [DocumentType.INSPECTION_REPORT]: 0.90,
};

// Deterministic mock scores — in production these come from the AI API response.
const MOCK_SCORES: Record<DocumentType, number> = {
    [DocumentType.TITLE_DEED]: 0.98,
    [DocumentType.IDENTITY_SELLER]: 0.99,
    [DocumentType.IDENTITY_BUYER]: 0.99,
    [DocumentType.PURCHASE_AGREEMENT]: 0.97,
    [DocumentType.MORTGAGE_APPROVAL]: 0.96,
    [DocumentType.INSPECTION_REPORT]: 0.94,
};

export const AI_NOTARY_ID = 'ai-notary-agent-v1';

export class NotaryAgentService {
    verifyAllDocuments(transactionId: string, service: TransactionService): void {
        const tx = service.getTransaction(transactionId);

        console.log(`\n  [AI Notary Agent] Analysing ${tx.documents.length} document(s) for transaction ${transactionId}...`);

        for (const doc of tx.documents) {
            if (doc.verified) continue;

            const score = MOCK_SCORES[doc.type] ?? 0.90;
            const threshold = CONFIDENCE_THRESHOLDS[doc.type] ?? 0.95;

            console.log(
                `  [AI Notary Agent] ${doc.type.padEnd(22)} → confidence: ${score.toFixed(2)}` +
                (score >= threshold ? '  ✓ APPROVED' : '  ✗ REJECTED'),
            );

            if (score < threshold) {
                throw new Error(
                    `AI Notary Agent rejected document "${doc.type}" — ` +
                    `confidence ${score.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
                );
            }

            service.verifyDocument(transactionId, doc.id, AI_NOTARY_ID);
        }

        console.log(`  [AI Notary Agent] All documents verified.\n`);
    }
}
