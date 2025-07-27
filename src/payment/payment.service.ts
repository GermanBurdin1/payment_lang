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
      this.logger.log(`[PaymentService] Création payment intent pour user ${dto.userId}, montant: ${dto.amount} ${dto.currency}`);

      // on crée ou récupère le customer
      let customerId = dto.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          metadata: {
            userId: dto.userId,
          },
        });
        customerId = customer.id;
      }

      // création du Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(dto.amount * 100), // Stripe fonctionne en centimes
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

      // sauvegarde en base de données
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
      this.logger.error(`[PaymentService] Erreur lors de la création du payment intent: ${error.message}`);
      throw new BadRequestException(`Échec de la création du payment intent: ${error.message}`);
    }
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    try {
      this.logger.log(`[PaymentService] Confirmation payment intent: ${dto.paymentIntentId}`);

      const payment = await this.paymentRepo.findOne({
        where: { stripePaymentIntentId: dto.paymentIntentId },
      });

      if (!payment) {
        throw new NotFoundException('Paiement non trouvé');
      }

      // on récupère le statut actuel du payment intent depuis Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);

      // si le payment intent est déjà confirmé, on met juste à jour le statut en BDD
      if (paymentIntent.status === 'succeeded') {
        this.logger.log(`[PaymentService] Payment intent ${dto.paymentIntentId} déjà réussi, mise à jour du statut en BDD`);
        
        payment.status = 'succeeded';
        payment.processedAt = new Date();
        
        const updatedPayment = await this.paymentRepo.save(payment);

        return {
          paymentId: updatedPayment.id,
          status: updatedPayment.status,
          paymentIntent: paymentIntent,
        };
      }

      // si le payment intent n'est pas encore confirmé, on essaie de le confirmer
      if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
        const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(dto.paymentIntentId, {
          payment_method: dto.paymentMethodId,
        });

        // mise à jour du statut en base de données
        payment.status = confirmedPaymentIntent.status as any;
        payment.processedAt = new Date();

        if (confirmedPaymentIntent.status === 'succeeded') {
          payment.status = 'succeeded';
        } else if (confirmedPaymentIntent.status === 'requires_payment_method') {
          payment.status = 'failed';
          payment.failureReason = 'Payment method required';
        } else if (confirmedPaymentIntent.status === 'requires_action') {
          payment.status = 'processing';
        }

        const updatedPayment = await this.paymentRepo.save(payment);

        return {
          paymentId: updatedPayment.id,
          status: updatedPayment.status,
          paymentIntent: confirmedPaymentIntent,
        };
      }

      // pour les autres statuts on met juste à jour la BDD
      payment.status = paymentIntent.status as any;
      payment.processedAt = new Date();
      
      const updatedPayment = await this.paymentRepo.save(payment);

      return {
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        paymentIntent: paymentIntent,
      };
    } catch (error) {
      this.logger.error(`[PaymentService] Erreur lors de la confirmation du paiement: ${error.message}`);
      throw new BadRequestException(`Échec de la confirmation du paiement: ${error.message}`);
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

      this.logger.log(`[PaymentService] Webhook reçu: ${event.type}`);

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
          this.logger.log(`[PaymentService] Type d'événement non géré: ${event.type}`);
          // TODO : implémenter la gestion d'autres types d'événements
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`[PaymentService] Erreur webhook: ${error.message}`);
      throw new BadRequestException(`Erreur webhook: ${error.message}`);
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
      this.logger.log(`[PaymentService] Paiement ${payment.id} marqué comme réussi`);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepo.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = 'failed';
      payment.failureReason = paymentIntent.last_payment_error?.message || 'Paiement échoué';
      payment.processedAt = new Date();
      await this.paymentRepo.save(payment);
      this.logger.log(`[PaymentService] Paiement ${payment.id} marqué comme échoué`);
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
      this.logger.log(`[PaymentService] Paiement ${payment.id} marqué comme annulé`);
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
      throw new NotFoundException('Paiement non trouvé');
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
      this.logger.error(`[PaymentService] Erreur lors de la création du customer: ${error.message}`);
      throw new BadRequestException(`Échec de la création du customer: ${error.message}`);
    }
  }

  async getCustomer(customerId: string) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      this.logger.error(`[PaymentService] Erreur lors de la récupération du customer: ${error.message}`);
      throw new BadRequestException(`Échec de la récupération du customer: ${error.message}`);
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      // mise à jour du statut en base de données
      const payment = await this.paymentRepo.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (payment) {
        payment.status = 'canceled';
        payment.processedAt = new Date();
        await this.paymentRepo.save(payment);
        // TODO : peut-être créer une entité Refund séparée pour tracker les remboursements
      }

      return refund;
    } catch (error) {
      this.logger.error(`[PaymentService] Erreur lors du remboursement: ${error.message}`);
      throw new BadRequestException(`Échec du remboursement: ${error.message}`);
    }
  }
} 