import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
  ) {}

  async createPayment(userId: string, amount: number, currency: string) {
    // Здесь будет интеграция со Stripe, пока просто заглушка
    const payment = this.paymentRepo.create({
      userId,
      amount,
      currency,
      status: 'success', // всегда успешная оплата
      stripePaymentId: null,
    });
    return this.paymentRepo.save(payment);
  }

  async getPaymentsForUser(userId: string) {
    return this.paymentRepo.find({ where: { userId } });
  }
} 