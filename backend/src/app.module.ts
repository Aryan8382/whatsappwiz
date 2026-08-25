import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuditModule } from './audit/audit.module';
import { WalletModule } from './wallet/wallet.module';
import { WabaModule } from './waba/waba.module';
import { ContactsModule } from './contacts/contacts.module';
import { TemplatesModule } from './templates/templates.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ChatbotsModule } from './chatbots/chatbots.module';
import { ReportsModule } from './reports/reports.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { UploadModule } from './upload/upload.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { MediaModule } from './media/media.module';
import { DndModule } from './dnd/dnd.module';
import { AutomationModule } from './automation/automation.module';
import { FlowsModule } from './flows/flows.module';
import { TemplateLibraryModule } from './template-library/template-library.module';
import { SegmentsModule } from './segments/segments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AuditModule,
    WalletModule,
    WabaModule,
    ContactsModule,
    TemplatesModule,
    RealtimeModule,
    WebhooksModule,
    MessagesModule,
    ConversationsModule,
    CampaignsModule,
    ChatbotsModule,
    ReportsModule,
    ApiKeysModule,
    UploadModule,
    CustomFieldsModule,
    MediaModule,
    DndModule,
    AutomationModule,
    FlowsModule,
    TemplateLibraryModule,
    SegmentsModule,
  ],
})
export class AppModule {}
