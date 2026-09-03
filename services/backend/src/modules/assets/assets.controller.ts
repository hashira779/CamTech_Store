import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AssetsService } from './assets.service';
import { CreateFixedAssetDto } from './dto/assets.dto';

@ApiTags('Fixed Assets & Depreciation')
@ApiBearerAuth()
@Controller({ path: 'assets', version: '1' })
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: 'List capitalized fixed assets' })
  async listAssets(@CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.listAssets(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: 'Get fixed asset details with depreciation history' })
  async getAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assetsService.getAsset(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: 'Register and capitalize a fixed asset' })
  async createAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.assetsService.createAsset(user.organizationId, dto as any);
  }

  @Post(':id/depreciate')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: 'Execute periodic depreciation run for an asset' })
  async runDepreciation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assetsService.runDepreciation(user.organizationId, id);
  }
}
