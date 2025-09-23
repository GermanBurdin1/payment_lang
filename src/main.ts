import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // nécessaire pour les webhooks Stripe
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.enableCors();

  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`[PaymentService] Service démarré sur le port ${port}`);
  console.log(`[PaymentService] Routes disponibles:`);
  console.log(`[PaymentService] - POST /payments/create-intent`);
  console.log(`[PaymentService] - POST /payments/confirm`);
  console.log(`[PaymentService] - POST /payments/webhook`);
  console.log(`[PaymentService] - GET /payments/user/:userId`);
  console.log(`[PaymentService] - GET /payments/:id`);
  // TODO : ajouter un health check endpoint
}
bootstrap(); 