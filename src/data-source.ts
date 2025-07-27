import { DataSource } from 'typeorm';
import { Payment } from './payment/payment.entity';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

dotenv.config();

Logger.log(`DB_USER: ${process.env.DB_USERNAME}, DB_PASS: ${process.env.DB_PASSWORD}`, 'DataSource');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgre',
  database: process.env.DB_NAME || 'payment_db',
  entities: [Payment],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  // TODO : configurer SSL et autres options de sécurité pour la prod
}); 