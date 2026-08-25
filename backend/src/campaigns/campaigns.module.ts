import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { MessagesModule } from '../messages/messages.module';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [MessagesModule, WalletModule, RealtimeModule, WebhooksModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignSchedulerService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
