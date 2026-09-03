import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser, type StockTransferStatus } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { WmsService } from './wms.service';
import {
  CreateWarehouseZoneDto,
  CreateWarehouseBinDto,
  CreateProductBatchDto,
  CreateStockTransferDto,
  UpdateStockTransferStatusDto,
  ReceiveStockTransferDto,
} from './dto/wms.dto';

@ApiTags('WMS & Stock Transfers')
@ApiBearerAuth()
@Controller({ path: 'wms', version: '1' })
export class WmsController {
  constructor(private readonly wmsService: WmsService) {}

  // ---------------------------------------------------------------------------
  // Zones & Bins
  // ---------------------------------------------------------------------------

  @Post('zones')
  @RequirePermissions(PERMISSIONS.WMS_WRITE)
  @ApiOperation({ summary: 'Create a warehouse zone' })
  async createZone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWarehouseZoneDto,
  ) {
    return this.wmsService.createZone(user.organizationId, user.id, dto as any);
  }

  @Get('zones')
  @RequirePermissions(PERMISSIONS.WMS_READ)
  @ApiOperation({ summary: 'List warehouse zones and their bins' })
  async listZones(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.wmsService.listZones(user.organizationId, locationId);
  }

  @Post('bins')
  @RequirePermissions(PERMISSIONS.WMS_WRITE)
  @ApiOperation({ summary: 'Create a warehouse bin location within a zone' })
  async createBin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWarehouseBinDto,
  ) {
    return this.wmsService.createBin(user.organizationId, user.id, dto as any);
  }

  // ---------------------------------------------------------------------------
  // Product Batches
  // ---------------------------------------------------------------------------

  @Post('batches')
  @RequirePermissions(PERMISSIONS.WMS_WRITE)
  @ApiOperation({ summary: 'Register a product batch / lot with expiry date' })
  async createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductBatchDto,
  ) {
    return this.wmsService.createBatch(user.organizationId, user.id, dto as any);
  }

  @Get('batches')
  @RequirePermissions(PERMISSIONS.WMS_READ)
  @ApiOperation({ summary: 'List product batches sorted by FEFO expiration' })
  async listBatches(
    @CurrentUser() user: AuthenticatedUser,
    @Query('productVariantId') productVariantId?: string,
  ) {
    return this.wmsService.listBatches(user.organizationId, productVariantId);
  }

  // ---------------------------------------------------------------------------
  // Stock Transfers
  // ---------------------------------------------------------------------------

  @Get('transfers')
  @RequirePermissions(PERMISSIONS.TRANSFERS_READ)
  @ApiOperation({ summary: 'List inter-branch stock transfers' })
  async listTransfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: StockTransferStatus,
    @Query('sourceLocationId') sourceLocationId?: string,
    @Query('destLocationId') destLocationId?: string,
  ) {
    return this.wmsService.listTransfers(user.organizationId, {
      status,
      sourceLocationId,
      destLocationId,
    });
  }

  @Get('transfers/:id')
  @RequirePermissions(PERMISSIONS.TRANSFERS_READ)
  @ApiOperation({ summary: 'Get stock transfer details' })
  async getTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.wmsService.getTransfer(user.organizationId, id);
  }

  @Post('transfers')
  @RequirePermissions(PERMISSIONS.TRANSFERS_WRITE)
  @ApiOperation({ summary: 'Create a new stock transfer request' })
  async createTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStockTransferDto,
  ) {
    return this.wmsService.createTransfer(user.organizationId, user.id, dto as any);
  }

  @Patch('transfers/:id/status')
  @RequirePermissions(PERMISSIONS.TRANSFERS_APPROVE)
  @ApiOperation({ summary: 'Update transfer status (APPROVE, CANCEL)' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStockTransferStatusDto,
  ) {
    return this.wmsService.updateStatus(
      user.organizationId,
      user.id,
      id,
      dto.status,
      dto.notes,
    );
  }

  @Post('transfers/:id/ship')
  @RequirePermissions(PERMISSIONS.TRANSFERS_WRITE)
  @ApiOperation({ summary: 'Dispatch goods to transit and atomically deduct source inventory' })
  async shipTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.wmsService.shipTransfer(user.organizationId, user.id, id);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions(PERMISSIONS.TRANSFERS_RECEIVE)
  @ApiOperation({ summary: 'Receive transfer at destination location and increment inventory' })
  async receiveTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
  ) {
    return this.wmsService.receiveTransfer(user.organizationId, user.id, id, dto as any);
  }
}
