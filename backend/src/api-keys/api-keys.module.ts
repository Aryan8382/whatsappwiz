import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';
import { ApiKeyGuard } from './api-key.guard';
import { MessagesModule } from '../messages/messages.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [MessagesModule, ContactsModule],
  controllers: [ApiKeysController, PublicApiController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
