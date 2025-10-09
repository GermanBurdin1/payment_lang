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
    const userId = req.user?.sub;
    this.logger.log(`[Payment Service] === CREATE PAYMENT INTENT DEBUG ===`);
    this.logger.log(`[Payment Service] Received request to: ${req.url}`);
    this.logger.log(`[Payment Service] Request path: ${req.path}`);
    this.logger.log(`[Payment Service] Request method: ${req.method}`);
    this.logger.log(`[Payment Service] Request body:`, dto);
    this.logger.log(`[Payment Service] User ID:`, userId);
    
    return this.paymentService.createPaymentIntent(dto, userId);
  }

  @Post('confirm')
  async confirmPayment(@Body() dto: ConfirmPaymentDto, @Req() req: any) {
    const userId = req.user?.sub;
    return this.paymentService.confirmPayment(dto, userId);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    // Webhook не требует JWT валидации, так как приходит от Stripe
    return this.paymentService.handleWebhook(signature, request.rawBody);
  }

  @Get('user/:userId')
  async getForUser(@Param('userId') userId: string, @Req() req: any) {
    const currentUserId = req.user?.sub;
    return this.paymentService.getPaymentsForUser(userId, currentUserId);
  }

  @Get(':id')
  async getPayment(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub;
    return this.paymentService.getPaymentById(id, userId);
  }

  @Post('customers')
  async createCustomer(@Body() body: { userId: string; email?: string; name?: string }, @Req() req: any) {
    const currentUserId = req.user?.sub;
    return this.paymentService.createCustomer(body.userId, body.email, body.name, currentUserId);
  }

  @Get('customers/:customerId')
  async getCustomer(@Param('customerId') customerId: string, @Req() req: any) {
    const userId = req.user?.sub;
    return this.paymentService.getCustomer(customerId, userId);
  }

  @Post('refund')
  async refundPayment(@Body() body: { paymentIntentId: string; amount?: number }, @Req() req: any) {
    const userId = req.user?.sub;
    return this.paymentService.refundPayment(body.paymentIntentId, body.amount, userId);
  }
} 