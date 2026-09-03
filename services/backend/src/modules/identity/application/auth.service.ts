import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { AuthenticatedUser, LoginResult, Role } from '@mystore/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import { expandPermissions } from '../../../common/auth/role-permissions';
import type { JwtPayload } from '../../../common/auth/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Uniform failure to avoid leaking which part was wrong (user enumeration).
    const invalid = () => AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');

    if (!user || !user.isActive) {
      await this.audit.record({
        action: 'LOGIN',
        resourceType: 'User',
        resourceId: user?.id,
        result: 'FAILURE',
        ip,
        metadata: { email, reason: user ? 'inactive' : 'not_found' },
      });
      throw invalid();
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'LOGIN',
        resourceType: 'User',
        resourceId: user.id,
        result: 'FAILURE',
        ip,
        metadata: { email, reason: 'bad_password' },
      });
      throw invalid();
    }

    const roles = this.parseRoles(user.roles);
    const permissions = expandPermissions(roles);

    const principal: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      roles,
      permissions,
    };

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org: user.organizationId,
      roles,
      perms: permissions,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '1h');
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      result: 'SUCCESS',
      ip,
    });

    return { accessToken, expiresIn, user: principal };
  }

  private parseRoles(raw: string): Role[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Role[]) : ['STAFF'];
    } catch {
      return ['STAFF'];
    }
  }
}
