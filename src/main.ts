import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Необходимо для webhooks Stripe
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.enableCors();

  const port = process.env.PORT || 3004;
  await app.listen(port);
  console.log(`Payment service is running on port ${port}`);
}
bootstrap(); 