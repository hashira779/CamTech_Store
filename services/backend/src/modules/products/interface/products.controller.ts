import { Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PERMISSIONS,
  type AuthenticatedUser,
  type Paginated,
  type ProductDto,
} from '@mystore/contracts';
import { ProductsService } from '../application/products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ListProductsQueryDto } from '../dto/list-products.query';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../../common/auth/permissions.decorator';

@ApiTags('products')
@ApiBearerAuth()
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: 'List products in the caller’s organization (paginated)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsQueryDto,
  ): Promise<Paginated<ProductDto>> {
    return this.products.listProducts(user, {
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_WRITE)
  @ApiOperation({ summary: 'Create a product' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Ip() ip: string,
  ): Promise<ProductDto> {
    const input = {
      ...dto,
      type: dto.type ?? 'PHYSICAL',
      isActive: dto.isActive ?? true,
      variants: dto.variants.map((v) => ({
        ...v,
        unit: v.unit ?? 'piece',
        currency: v.currency ?? 'USD',
        taxRatePct: v.taxRatePct ?? 0,
        isActive: v.isActive ?? true,
      })),
    };
    return this.products.createProduct(user, input, ip);
  }
}
