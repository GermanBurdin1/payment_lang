import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Headers,
  RawBodyRequest,
  Req,
  Logger
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto, @Req() req: any) {
    this.logger.log(`[Payment Service] === CREATE PAYMENT INTENT DEBUG ===`);
    this.logger.log(`[Payment Service] Received request to: ${req.url}`);
    this.logger.log(`[Payment Service] Request path: ${req.path}`);
    this.logger.log(`[Payment Service] Request method: ${req.method}`);
    this.logger.log(`[Payment Service] Request body:`, dto);
    
    return this.paymentService.createPaymentIntent(dto);
  }

  @Post('confirm')
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return this.paymentService.confirmPayment(dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.paymentService.handleWebhook(signature, request.rawBody);
  }

  @Get('user/:userId')
  async getForUser(@Param('userId') userId: string) {
    return this.paymentService.getPaymentsForUser(userId);
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    return this.paymentService.getPaymentById(id);
  }

  @Post('customers')
  async createCustomer(@Body() body: { userId: string; email?: string; name?: string }) {
    return this.paymentService.createCustomer(body.userId, body.email, body.name);
  }

  @Get('customers/:customerId')
  async getCustomer(@Param('customerId') customerId: string) {
    return this.paymentService.getCustomer(customerId);
  }

  @Post('refund')
  async refundPayment(@Body() body: { paymentIntentId: string; amount?: number }) {
    return this.paymentService.refundPayment(body.paymentIntentId, body.amount);
  }
} 