import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './payment.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

describe('PaymentService', () => {
  let service: PaymentService;
  let repo: Repository<Payment>;
  let configService: ConfigService;
  let stripeMock: any;

  const mockPayment = {
    id: 'uuid-1',
    userId: 'user-1',
    amount: 100.0,
    currency: 'EUR',
    status: 'pending',
    stripePaymentIntentId: 'pi_123',
    stripeCustomerId: 'cus_123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Payment;

  const repoMock = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: jest.fn().mockResolvedValue(mockPayment),
    findOne: jest.fn().mockResolvedValue(mockPayment),
    find: jest.fn().mockResolvedValue([mockPayment]),
  };

  beforeEach(async () => {
    stripeMock = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_123' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'cus_123', email: 'test@mail.com' }),
      },
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'secret', status: 'requires_payment_method' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' }),
        confirm: jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' }),
      },
      refunds: {
        create: jest.fn().mockResolvedValue({ id: 're_123', status: 'succeeded' }),
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_123' } } }),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: repoMock },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    repo = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    // @ts-ignore
    service.stripe = stripeMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a payment intent', async () => {
    const dto = { userId: 'user-1', amount: 100, currency: 'EUR' } as any;
    const result = await service.createPaymentIntent(dto);
    expect(stripeMock.customers.create).toHaveBeenCalled();
    expect(stripeMock.paymentIntents.create).toHaveBeenCalled();
    expect(repoMock.create).toHaveBeenCalled();
    expect(repoMock.save).toHaveBeenCalled();
    expect(result).toHaveProperty('paymentId');
    expect(result).toHaveProperty('clientSecret');
  });

  it('should get payment by id', async () => {
    const result = await service.getPaymentById('uuid-1');
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    expect(result).toEqual(mockPayment);
  });

  it('should get payments for user', async () => {
    const result = await service.getPaymentsForUser('user-1');
    expect(repoMock.find).toHaveBeenCalledWith({ where: { userId: 'user-1' }, order: { createdAt: 'DESC' } });
    expect(result).toEqual([mockPayment]);
  });

  it('should confirm payment', async () => {
    const dto = { paymentIntentId: 'pi_123', paymentMethodId: 'pm_123' } as any;
    const result = await service.confirmPayment(dto);
    expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_123' } });
    expect(repoMock.save).toHaveBeenCalled();
    expect(result).toHaveProperty('status');
  });

  it('should refund payment', async () => {
    const result = await service.refundPayment('pi_123', 10);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_123', amount: 1000 });
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_123' } });
    expect(repoMock.save).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 're_123');
  });

  it('should handle error in createPaymentIntent', async () => {
    stripeMock.customers.create.mockRejectedValueOnce(new Error('Stripe error'));
    await expect(service.createPaymentIntent({ userId: 'user-1', amount: 100, currency: 'EUR' } as any)).rejects.toThrow();
  });

  it('should throw NotFoundException if payment not found', async () => {
    repoMock.findOne.mockResolvedValueOnce(undefined);
    await expect(service.getPaymentById('not-exist')).rejects.toThrow('Payment not found');
  });
}); 