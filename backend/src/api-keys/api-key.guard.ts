import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) throw new UnauthorizedException('Missing X-Api-Key header');
    const result = await this.apiKeys.validate(apiKey);
    request.user = {
      sub: 0,
      organizationId: result.organizationId,
      role: 'org_admin',
      apiKeyId: result.apiKeyId,
    };
    return true;
  }
}
