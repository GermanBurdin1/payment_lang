import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ 
    type: 'enum', 
    enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
    default: 'pending'
  })
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';

  @Column({ nullable: true })
  stripePaymentIntentId?: string;

  @Column({ nullable: true })
  stripeCustomerId?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  metadata?: string; // JSON string for additional data

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  // TODO : ajouter des champs pour les fees et commissions
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 