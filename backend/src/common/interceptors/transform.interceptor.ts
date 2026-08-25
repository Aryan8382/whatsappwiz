import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export function transformValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => transformValue(v));
  if (typeof value === 'object') {
    if (typeof (value as any).toJSON === 'function') {
      return transformValue((value as any).toJSON());
    }
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      out[key] = transformValue((value as Record<string, any>)[key]);
    }
    return out;
  }
  return value;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transformValue(data)));
  }
}
