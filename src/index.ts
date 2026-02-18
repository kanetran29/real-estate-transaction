import express from 'express';
import { TransactionService } from './services/TransactionService';
import { createTransactionRouter } from './routes/transactions';

const app = express();
const port = 3000;

app.use(express.json());

const transactionService = new TransactionService();
app.use('/api/transactions', createTransactionRouter(transactionService));

app.get('/', (_req, res) => {
  res.json({
    message: 'Real Estate Transaction Automation API',
    endpoints: {
      'POST /api/transactions': 'Initiate a new transaction',
      'GET /api/transactions': 'Get all transactions',
      'GET /api/transactions/:id': 'Get transaction by ID',
      'POST /api/transactions/:id/documents': 'Upload document',
      'PATCH /api/transactions/:id/documents/:documentId/verify': 'Verify document',
      'POST /api/transactions/:id/payments': 'Process payment',
      'POST /api/transactions/:id/complete': 'Complete ownership transfer',
      'POST /api/transactions/:id/cancel': 'Cancel transaction'
    }
  });
});

app.listen(port, () => {
  console.log(`Real Estate Transaction API running on http://localhost:${port}`);
});
