import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationSettingsDto } from './dto/organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  @ApiOperation({ summary: 'Get current organization profile and configuration' })
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getCurrent(user.organizationId);
  }

  @Patch('current/settings')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @ApiOperation({ summary: 'Update organization settings and feature flags' })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    return this.organizationsService.updateSettings(user.organizationId, dto as any, user.id);
  }
}
