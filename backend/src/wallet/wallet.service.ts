import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async ensureWallet(organizationId: number) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { organizationId: BigInt(organizationId) },
    });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { organizationId: BigInt(organizationId), balance: 0.00 },
      });
    }
    return wallet;
  }

  async getWallet(organizationId: number) {
    const wallet = await this.ensureWallet(organizationId);
    return wallet;
  }

  async balance(organizationId: number) {
    const wallet = await this.ensureWallet(organizationId);
    return { balance: wallet.balance, currency: wallet.currency };
  }

  async credit(
    organizationId: number,
    amount: number,
    type: string,
    reference?: string,
    description?: string,
  ) {
    const wallet = await this.ensureWallet(organizationId);
    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: wallet.balance.add(amount),
      },
    });
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        balanceAfter: updated.balance,
        reference: reference || null,
        description: description || null,
      },
    });
    return updated;
  }

  async debit(
    organizationId: number,
    amount: number,
    type: string,
    reference?: string,
    description?: string,
  ) {
    const wallet = await this.ensureWallet(organizationId);
    if (wallet.balance.lessThan(amount)) {
      throw new BadRequestException(
        `Insufficient wallet balance. Required ${amount}, available ${wallet.balance}`,
      );
    }
    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: wallet.balance.sub(amount),
      },
    });
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount: -amount,
        balanceAfter: updated.balance,
        reference: reference || null,
        description: description || null,
      },
    });
    return updated;
  }

  async adjustBalance(
    organizationId: number,
    amount: number,
    reference?: string,
  ) {
    if (amount >= 0) {
      return this.credit(organizationId, amount, 'credit', reference, 'Admin adjustment');
    }
    return this.debit(organizationId, -amount, 'debit', reference, 'Admin adjustment');
  }

  async transactions(organizationId: number, page = 1, limit = 50) {
    const wallet = await this.ensureWallet(organizationId);
    const where = { walletId: wallet.id };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async invoices(organizationId: number) {
    return this.prisma.invoice.findMany({
      where: { organizationId: BigInt(organizationId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invoiceDetail(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(invoiceId) },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async recharge(organizationId: number, amount: number, method: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const ref = `RECH-${Date.now()}`;
    const updated = await this.credit(
      organizationId,
      amount,
      'recharge',
      ref,
      `Wallet recharge via ${method || 'demo-payment'}`,
    );
    const taxRate = 0.18;
    const subtotal = Math.round(amount * 100) / 100;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax;
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: BigInt(organizationId),
        invoiceNumber: `INV-${Date.now()}`,
        subtotal,
        tax,
        total,
        status: 'paid',
      },
    });
    return { wallet: updated, invoice, reference: ref };
  }
}
