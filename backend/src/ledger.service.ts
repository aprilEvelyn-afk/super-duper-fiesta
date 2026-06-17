import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

@Injectable()
export class LedgerService {
  // Create an internal transfer with double-entry ledger inside a single DB transaction.
  async internalTransfer(opts: {
    userId: number;
    fromAccountId: number;
    toAccountId: number;
    amount: string; // decimal string
    currency?: string;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }) {
    const { userId, fromAccountId, toAccountId, amount, currency = 'USD', idempotencyKey, metadata } = opts;
    const amt = new Decimal(amount);
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');

    // Idempotency: return existing if idempotency key was used
    if (idempotencyKey) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey }
      });
      if (existing) return existing;
    }

    return await prisma.$transaction(async (tx) => {
      // Fetch accounts FOR UPDATE-ish by selecting rows (Prisma doesn't expose SELECT FOR UPDATE directly;
      // on Postgres you can use tx.$executeRaw`SELECT ... FOR UPDATE` if strict locking is required).
      const fromAcc = await tx.account.findUnique({ where: { id: fromAccountId } });
      const toAcc = await tx.account.findUnique({ where: { id: toAccountId } });
      if (!fromAcc || !toAcc) throw new BadRequestException('Account not found');
      if (fromAcc.currency !== currency || toAcc.currency !== currency) throw new BadRequestException('Currency mismatch');

      // Basic balance check (for debit)
      if (new Decimal(fromAcc.balance).lt(amt)) {
        throw new BadRequestException('Insufficient funds');
      }

      // Create transaction record
      const txn = await tx.transaction.create({
        data: {
          userId,
          fromAccountId,
          toAccountId,
          amount: amt.toString(),
          currency,
          status: 'posted',
          idempotencyKey,
        }
      });

      // Create ledger entries (debit from fromAccount, credit to toAccount)
      await tx.ledgerEntry.createMany({
        data: [
          {
            transactionId: txn.id,
            accountId: fromAccountId,
            entryType: 'debit',
            contraAccountId: toAccountId,
            amount: amt.toString(),
            currency,
            metadata
          },
          {
            transactionId: txn.id,
            accountId: toAccountId,
            entryType: 'credit',
            contraAccountId: fromAccountId,
            amount: amt.toString(),
            currency,
            metadata
          }
        ]
      });

      // Update balances
      const newFromBalance = new Decimal(fromAcc.balance).minus(amt).toString();
      const newToBalance = new Decimal(toAcc.balance).plus(amt).toString();

      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: newFromBalance }
      });
      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: newToBalance }
      });

      // Optionally write an audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'internal_transfer',
          resource: `transaction:${txn.id}`,
          diff: { fromAccountId, toAccountId, amount: amt.toString() },
        }
      });

      return txn;
    });
  }
}
