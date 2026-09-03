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
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ProcurementService } from './procurement.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  CreateGoodsReceiptDto,
} from './dto/procurement.dto';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller({ path: 'procurement', version: '1' })
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ─── Suppliers ──────────────────────────────────────────────────

  @Post('suppliers')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_WRITE)
  @ApiOperation({ summary: 'Register a new vendor/supplier' })
  async createSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.procurementService.createSupplier(user.organizationId, dto as any, user.id);
  }

  @Get('suppliers')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_READ)
  @ApiOperation({ summary: 'List suppliers with pagination and search' })
  async listSuppliers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.procurementService.listSuppliers(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
    });
  }

  @Patch('suppliers/:id')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_WRITE)
  @ApiOperation({ summary: 'Update supplier details' })
  async updateSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.procurementService.updateSupplier(user.organizationId, id, dto as any, user.id);
  }

  // ─── Purchase Orders ────────────────────────────────────────────

  @Post('orders')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_WRITE)
  @ApiOperation({ summary: 'Create a new purchase order' })
  async createPO(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.procurementService.createPO(user.organizationId, dto as any, user.id);
  }

  @Get('orders')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_READ)
  @ApiOperation({ summary: 'List purchase orders with pagination and filters' })
  async listPOs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
  ) {
    return this.procurementService.listPOs(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      supplierId,
      locationId,
      search,
    });
  }

  @Get('orders/:id')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_READ)
  @ApiOperation({ summary: 'Get full purchase order details' })
  async getPOById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.procurementService.getPOById(user.organizationId, id);
  }

  @Post('orders/:id/approve')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_APPROVE)
  @ApiOperation({ summary: 'Approve a purchase order for fulfillment' })
  async approvePO(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.procurementService.approvePO(user.organizationId, id, user.id);
  }

  @Post('orders/:id/cancel')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_WRITE)
  @ApiOperation({ summary: 'Cancel a purchase order' })
  async cancelPO(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.procurementService.cancelPO(user.organizationId, id, user.id);
  }

  // ─── Goods Receipt Notes (GRN) & Stock Inbound ──────────────────

  @Post('orders/:id/receive')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_RECEIVE)
  @ApiOperation({ summary: 'Receive shipment against PO: creates GRN and atomically increments stock' })
  async receiveGoods(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.procurementService.receiveGoods(user.organizationId, id, dto as any, user.id);
  }

  @Get('receipts')
  @RequirePermissions(PERMISSIONS.PROCUREMENT_READ)
  @ApiOperation({ summary: 'List goods receipt notes (GRN)' })
  async listGoodsReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('poId') poId?: string,
  ) {
    return this.procurementService.listGoodsReceipts(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      poId,
    });
  }
}
