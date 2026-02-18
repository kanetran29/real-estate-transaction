import { v4 as uuidv4 } from 'uuid';
import { GeneratedContract, Transaction } from '../models/Transaction';

// Simulates an AI/template engine that auto-generates a purchase agreement
// from the transaction details. In production this would call a DocuSign
// template API or an LLM to produce a legally-formatted PDF.

export class ContractService {
    private static readonly TEMPLATE_VERSION = 'v2.1-AI';

    generateContract(tx: Transaction): GeneratedContract {
        const contract: GeneratedContract = {
            id: `CONTRACT-${uuidv4().slice(0, 8).toUpperCase()}`,
            templateVersion: ContractService.TEMPLATE_VERSION,
            generatedAt: new Date(),
            propertyAddress: tx.property.address,
            sellerName: tx.seller.name,
            buyerName: tx.buyer.name,
            agreedPrice: tx.property.price,
            content: this.renderTemplate(tx),
        };

        console.log(
            `  [ContractService] Purchase agreement auto-generated ` +
            `(id: ${contract.id}, template: ${contract.templateVersion})`,
        );

        return contract;
    }

    private renderTemplate(tx: Transaction): string {
        return [
            `PURCHASE AGREEMENT`,
            `──────────────────────────────────────────`,
            `Property : ${tx.property.address}`,
            `           ${tx.property.squareMeters} m²  |  ${tx.property.description ?? ''}`,
            `Seller   : ${tx.seller.name} <${tx.seller.email}>`,
            `Buyer    : ${tx.buyer.name} <${tx.buyer.email}>`,
            `Price    : €${tx.property.price.toLocaleString()}`,
            `Date     : ${new Date().toISOString().slice(0, 10)}`,
            `──────────────────────────────────────────`,
            `This agreement is auto-generated and legally binding upon e-signature`,
            `by both parties. Funds will be held in escrow until deed transfer.`,
        ].join('\n');
    }
}
