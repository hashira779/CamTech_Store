import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { StorageService } from './storage.service';
import {
  CreateUploadIntentDto,
  ConfirmUploadDto,
  ListDocumentsQueryDto,
} from './dto/storage.dto';
import type { Request, Response } from 'express';
import * as fs from 'fs';

@ApiTags('Storage & Documents')
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-intent')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.STORAGE_WRITE)
  @ApiOperation({ summary: 'Request presigned upload intent for document/media' })
  async createUploadIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadIntentDto,
  ) {
    return this.storageService.createUploadIntent(user.organizationId, user.id, dto as any);
  }

  @Post('confirm-upload')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.STORAGE_WRITE)
  @ApiOperation({ summary: 'Confirm file upload completion and activate document' })
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.storageService.confirmUpload(user.organizationId, user.id, dto);
  }

  @Put('upload/:key')
  @Public()
  @ApiOperation({ summary: 'Local storage direct upload endpoint' })
  async directUpload(
    @Param('key') key: string,
    @Req() req: Request,
  ) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);
    const mimeType = req.headers['content-type'] || 'application/octet-stream';
    await this.storageService.saveDirectFile(decodeURIComponent(key), buffer, mimeType);
    return { success: true };
  }

  @Get('files/:key')
  @Public()
  @ApiOperation({ summary: 'Serve stored file' })
  async serveFile(
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = await this.storageService.getFilePathForServing(decodeURIComponent(key));
    const stream = fs.createReadStream(filePath);
    return new StreamableFile(stream);
  }

  @Get('documents')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.STORAGE_READ)
  @ApiOperation({ summary: 'List active documents for organization' })
  async listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.storageService.listDocuments(user.organizationId, query as any);
  }

  @Delete('documents/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.STORAGE_WRITE)
  @ApiOperation({ summary: 'Delete document and remove object from storage' })
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.storageService.deleteDocument(user.organizationId, user.id, id);
  }

  @Get('stats')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.STORAGE_READ)
  @ApiOperation({ summary: 'Get storage usage metrics and provider status' })
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.storageService.getStats(user.organizationId);
  }
}
