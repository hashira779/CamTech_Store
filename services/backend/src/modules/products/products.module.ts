import { Module } from '@nestjs/common';
import { ProductsController } from './interface/products.controller';
import { ProductsService } from './application/products.service';
import { PRODUCT_REPOSITORY } from './domain/product.repository';
import { PrismaProductRepository } from './infrastructure/prisma-product.repository';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    // Bind the repository port to its Prisma implementation (spec §4).
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
