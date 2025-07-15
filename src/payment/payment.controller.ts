import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Headers,
  RawBodyRequest,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
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