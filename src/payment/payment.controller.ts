import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async create(@Body() body: { userId: string; amount: number; currency: string }) {
    return this.paymentService.createPayment(body.userId, body.amount, body.currency);
  }

  @Get('user/:userId')
  async getForUser(@Param('userId') userId: string) {
    return this.paymentService.getPaymentsForUser(userId);
  }
} 