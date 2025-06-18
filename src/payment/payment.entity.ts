import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: string; // 'pending', 'success', 'failed'

  @Column({ nullable: true })
  stripePaymentId?: string;

  @CreateDateColumn()
  createdAt: Date;
} 