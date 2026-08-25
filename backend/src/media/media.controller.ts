import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const uploadDir = join(process.cwd(), 'uploads', 'media');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private media: MediaService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.media.list(user.organizationId, search);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB, matches UI copy
    }),
  )
  async upload(@CurrentUser() user: any, @UploadedFile() file: any) {
    if (!file) return { error: 'No file uploaded' };
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return this.media.create(user.organizationId, user.sub, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${backendUrl}/uploads/media/${file.filename}`,
    });
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.media.remove(user.organizationId, +id);
  }
}
