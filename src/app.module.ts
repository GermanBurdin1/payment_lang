import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from './payment/payment.module';
import { Payment } from './payment/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'payments',
      entities: [Payment],
      synchronize: true,
    }),
    PaymentModule,
  ],
})
export class AppModule {} 