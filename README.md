# Payment Service

Микросервис для обработки платежей через Stripe.

## Установка

```bash
npm install
```

## Настройка

1. Создайте файл `.env` на основе `.env.example`:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgre
DB_NAME=payment_service

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Application Configuration
PORT=3004
NODE_ENV=development
```

2. Получите ключи Stripe:
   - Зарегистрируйтесь на [stripe.com](https://stripe.com)
   - Перейдите в Dashboard → Developers → API Keys
   - Скопируйте Secret Key и Publishable Key

3. Настройте Webhook:
   - В Stripe Dashboard перейдите в Developers → Webhooks
   - Создайте новый webhook с URL: `https://your-domain.com/payments/webhook`
   - Выберите события: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - Скопируйте Webhook Secret

## Запуск

```bash
# Разработка
npm run start:dev

# Продакшн
npm run build
npm run start:prod
```

## API Endpoints

### Создание Payment Intent
```http
POST /payments/create-intent
Content-Type: application/json

{
  "userId": "user123",
  "amount": 29.99,
  "currency": "USD",
  "description": "Premium subscription",
  "metadata": {
    "subscriptionType": "premium"
  }
}
```

### Подтверждение платежа
```http
POST /payments/confirm
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890",
  "paymentMethodId": "pm_1234567890"
}
```

### Получение платежей пользователя
```http
GET /payments/user/user123
```

### Создание клиента
```http
POST /payments/customers
Content-Type: application/json

{
  "userId": "user123",
  "email": "user@example.com",
  "name": "John Doe"
}
```

### Возврат средств
```http
POST /payments/refund
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890",
  "amount": 29.99
}
```

## Webhook

Stripe отправляет webhook события на `/payments/webhook`. Сервис автоматически обрабатывает:
- `payment_intent.succeeded` - платеж успешен
- `payment_intent.payment_failed` - платеж не удался
- `payment_intent.canceled` - платеж отменен

## Миграции

```bash
# Генерация миграции
npm run typeorm:migration:generate -- -d src/data-source.ts --name MigrationName

# Применение миграций
npm run typeorm:migration:run

# Откат последней миграции
npm run typeorm:migration:revert
```

## Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e

# Покрытие кода
npm run test:cov
``` 