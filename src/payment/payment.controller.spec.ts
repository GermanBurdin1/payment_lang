import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: PaymentService;

  // mock complet du service de paiement
  const serviceMock = {
    createPaymentIntent: jest.fn().mockResolvedValue({ paymentId: '1', clientSecret: 'secret' }),
    confirmPayment: jest.fn().mockResolvedValue({ paymentId: '1', status: 'succeeded' }),
    handleWebhook: jest.fn().mockResolvedValue({ received: true }),
    getPaymentsForUser: jest.fn().mockResolvedValue([{ id: '1' }]),
    getPaymentById: jest.fn().mockResolvedValue({ id: '1' }),
    createCustomer: jest.fn().mockResolvedValue({ id: 'cus_1' }),
    getCustomer: jest.fn().mockResolvedValue({ id: 'cus_1', email: 'test@mail.com' }),
    refundPayment: jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create payment intent', async () => {
    const dto = { userId: 'u1', amount: 100, currency: 'EUR' };
    const result = await controller.createPaymentIntent(dto);
    expect(service.createPaymentIntent).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ paymentId: '1', clientSecret: 'secret' });
  });

  it('should confirm payment', async () => {
    const dto = { paymentIntentId: 'pi_1', paymentMethodId: 'pm_1' };
    const result = await controller.confirmPayment(dto);
    expect(service.confirmPayment).toHaveBeenCalledWith(dto);
    // TODO : tester aussi le cas où la confirmation échoue
  });

  it('should handle webhook', async () => {
    const signature = 'sig_123';
    const req: any = { rawBody: Buffer.from('test') };
    const result = await controller.handleWebhook(signature, req);
    expect(service.handleWebhook).toHaveBeenCalledWith(signature, req.rawBody);
    expect(result).toEqual({ received: true });
  });

  it('should get payments for user', async () => {
    const result = await controller.getForUser('u1');
    expect(service.getPaymentsForUser).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('should get payment by id', async () => {
    const result = await controller.getPayment('1');
    expect(service.getPaymentById).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1' });
  });

  it('should create customer', async () => {
    const body = { userId: 'u1', email: 'test@mail.com', name: 'Test' };
    const result = await controller.createCustomer(body);
    expect(service.createCustomer).toHaveBeenCalledWith('u1', 'test@mail.com', 'Test');
    expect(result).toEqual({ id: 'cus_1' });
  });

  it('should get customer', async () => {
    const result = await controller.getCustomer('cus_1');
    expect(service.getCustomer).toHaveBeenCalledWith('cus_1');
    expect(result).toEqual({ id: 'cus_1', email: 'test@mail.com' });
  });

  it('should refund payment', async () => {
    const body = { paymentIntentId: 'pi_1', amount: 10 };
    const result = await controller.refundPayment(body);
    expect(service.refundPayment).toHaveBeenCalledWith('pi_1', 10);
    expect(result).toEqual({ id: 're_1', status: 'succeeded' });
  });
}); 