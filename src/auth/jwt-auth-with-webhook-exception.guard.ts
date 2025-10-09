import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthWithWebhookExceptionGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Исключаем webhook из JWT валидации
    if (request.url && request.url.includes('/webhook')) {
      return true;
    }
    
    return super.canActivate(context);
  }
}




