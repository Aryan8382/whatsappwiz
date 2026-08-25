import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IpAddress = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.ip ||
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      'unknown'
    );
  },
);
