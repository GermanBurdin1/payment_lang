import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from './payment.entity';
import { CreatePaymentDto, CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    try {
      this.logger.log(`Creating payment intent for user ${dto.userId}, amount: ${dto.amount} ${dto.currency}`);

      // Создаем или получаем customer
      let customerId = dto.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          metadata: {
            userId: dto.userId,
          },
        });
        customerId = customer.id;
      }

      // Создаем Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(dto.amount * 100), // Stripe работает в центах
        currency: dto.currency.toLowerCase(),
        customer: customerId,
        description: dto.description,
        metadata: {
          userId: dto.userId,
          ...dto.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Сохраняем в базу данных
      const payment = this.paymentRepo.create({
        userId: dto.userId,
        amount: dto.amount,
        currency: dto.currency,
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerId,
        description: dto.description,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      });

      const savedPayment = await this.paymentRepo.save(payment);

      return {
        paymentId: savedPayment.id,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId,
      };
    } catch (error) {
      this.logger.error(`Error creating payment intent: ${error.message}`);
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    try {
      this.logger.log(`Confirming payment intent: ${dto.paymentIntentId}`);

      const payment = await this.paymentRepo.findOne({
        where: { stripePaymentIntentId: dto.paymentIntentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Подтверждаем Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.confirm(dto.paymentIntentId, {
        payment_method: dto.paymentMethodId,
      });

      // Обновляем статус в базе данных
      payment.status = paymentIntent.status as any;
      payment.processedAt = new Date();

      if (paymentIntent.status === 'succeeded') {
        payment.status = 'succeeded';
      } else if (paymentIntent.status === 'requires_payment_method') {
        payment.status = 'failed';
        payment.failureReason = 'Payment method required';
      } else if (paymentIntent.status === 'requires_action') {
        payment.status = 'processing';
      }

      const updatedPayment = await this.paymentRepo.save(payment);

      return {
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        paymentIntent: paymentIntent,
      };
    } catch (error) {
      this.logger.error(`Error confirming payment: ${error.message}`);
      throw new BadRequestException(`Failed to confirm payment: ${error.message}`);
    }
  }

  async handleWebhook(signature: string, payload: Buffer) {
    try {
      const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      this.logger.log(`Received webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepo.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = 'succeeded';
      payment.processedAt = new Date();
      await this.paymentRepo.save(payment);
      this.logger.log(`Payment ${payment.id} marked as succeeded`);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepo.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = 'failed';
      payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
      payment.processedAt = new Date();
      await this.paymentRepo.save(payment);
      this.logger.log(`Payment ${payment.id} marked as failed`);
    }
  }

  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepo.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = 'canceled';
      payment.processedAt = new Date();
      await this.paymentRepo.save(payment);
      this.logger.log(`Payment ${payment.id} marked as canceled`);
    }
  }

  async getPaymentsForUser(userId: string) {
    return this.paymentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async createCustomer(userId: string, email?: string, name?: string) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      return customer;
    } catch (error) {
      this.logger.error(`Error creating customer: ${error.message}`);
      throw new BadRequestException(`Failed to create customer: ${error.message}`);
    }
  }

  async getCustomer(customerId: string) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      this.logger.error(`Error retrieving customer: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve customer: ${error.message}`);
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      // Обновляем статус в базе данных
      const payment = await this.paymentRepo.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (payment) {
        payment.status = 'canceled';
        payment.processedAt = new Date();
        await this.paymentRepo.save(payment);
      }

      return refund;
    } catch (error) {
      this.logger.error(`Error refunding payment: ${error.message}`);
      throw new BadRequestException(`Failed to refund payment: ${error.message}`);
    }
  }
} 