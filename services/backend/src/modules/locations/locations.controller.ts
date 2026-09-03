import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LOCATIONS_WRITE)
  @ApiOperation({ summary: 'Create a new organizational location/branch node' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locationsService.create(user.organizationId, dto as any, user.id);
  }

  @Get('tree')
  @RequirePermissions(PERMISSIONS.LOCATIONS_READ)
  @ApiOperation({ summary: 'Get full recursive organizational hierarchy tree' })
  async getTree(@CurrentUser() user: AuthenticatedUser) {
    return this.locationsService.getTree(user.organizationId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LOCATIONS_READ)
  @ApiOperation({ summary: 'List locations with pagination and optional filters' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.locationsService.findAll(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      type,
      parentId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LOCATIONS_READ)
  @ApiOperation({ summary: 'Get location details by ID' })
  async findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.locationsService.findById(user.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LOCATIONS_WRITE)
  @ApiOperation({ summary: 'Update a location node or re-assign its parent' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(user.organizationId, id, dto as any, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LOCATIONS_WRITE)
  @ApiOperation({ summary: 'Delete a leaf location node' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.locationsService.delete(user.organizationId, id, user.id);
  }
}
