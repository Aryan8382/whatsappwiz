import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { WebhookReceiverController } from './webhook-receiver.controller';
import { WebhookReceiverService } from './webhook-receiver.service';
import { MockWhatsappService } from './mock-whatsapp.service';
import { MessengerService } from './messenger.service';
import { BotEngineService } from './bot-engine.service';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PublicTestController } from './public-test.controller';
import { MessengerController } from './messenger.controller';

@Module({
  imports: [WalletModule, RealtimeModule, WebhooksModule],
  controllers: [
    MessagesController,
    WebhookReceiverController,
    PublicTestController,
    MessengerController,
  ],
  providers: [
    MessagesService,
    WebhookReceiverService,
    MockWhatsappService,
    MessengerService,
    BotEngineService,
  ],
  exports: [MessagesService, MockWhatsappService, MessengerService, WebhookReceiverService],
})
export class MessagesModule {}

