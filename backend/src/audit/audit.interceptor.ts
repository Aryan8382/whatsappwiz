import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || 'GET').toUpperCase();
    if (!MUTATING.has(method)) return next.handle();

    const url: string = req.originalUrl || req.url || '';
    const base = url.split('?')[0].replace(/^\/api\/v1/, '');
    const segments = base.split('/').filter(Boolean);
    const action = segments.length
      ? `${method} /${segments.join('/')}`
      : method;
    const entity = segments.length
      ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      : null;

    return next.handle().pipe(
      tap({
        next: () => this.safeLog(req, action, entity),
        error: (err: unknown) =>
          this.safeLog(
            req,
            `${action} (failed: ${String(
              err && typeof err === 'object' && 'message' in err
                ? (err as { message: unknown }).message
                : err,
            ).slice(0, 200)})`,
            entity,
          ),
      }),
    );
  }

  private safeLog(req: Record<string, unknown>, action: string, entity: string | null) {
    const user = (req.user as { sub?: number; organizationId?: number } | undefined) || undefined;
    this.audit.log({
      organizationId: user?.organizationId,
      userId: user?.sub,
      action,
      entity: entity || undefined,
      ip: (req.ip as string) || undefined,
    });
  }
}
