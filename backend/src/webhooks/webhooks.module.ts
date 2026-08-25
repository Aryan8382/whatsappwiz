import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhookDispatchService } from './webhook-dispatch.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDispatchService],
  exports: [WebhooksService, WebhookDispatchService],
})
export class WebhooksModule {}
