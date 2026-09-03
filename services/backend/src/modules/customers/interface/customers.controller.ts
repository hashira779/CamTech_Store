import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../../common/auth/permissions.decorator';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { CustomersService } from '../application/customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from '../dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    const entity = await this.customers.create(user.organizationId, dto as any, user.id);
    return entity.toDto();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.customers.findAll(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      type,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const entity = await this.customers.findById(user.organizationId, id);
    return entity.toDto();
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_WRITE)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const entity = await this.customers.update(user.organizationId, id, dto as any, user.id);
    return entity.toDto();
  }
}
