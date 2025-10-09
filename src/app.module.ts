// Полифилл для crypto в Node.js 18
import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from './payment/payment.module';
import { Payment } from './payment/payment.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthWithWebhookExceptionGuard } from './auth/jwt-auth-with-webhook-exception.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: +config.get<number>('DB_PORT')!,
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [Payment],
        migrations: ['dist/migrations/*.js'],
        synchronize: true,
      }),
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      verifyOptions: {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISS,
      },
    }),

    PaymentModule,
  ],
  providers: [
    JwtStrategy,
    // Делаем guard глобальным для сервиса с исключением webhook:
    { provide: APP_GUARD, useClass: JwtAuthWithWebhookExceptionGuard },
  ],
  // TODO : ajouter des modules de logging et monitoring pour les paiements
})
export class AppModule {} 