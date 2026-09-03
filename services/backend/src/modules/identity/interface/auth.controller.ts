import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser, LoginResult } from '@mystore/contracts';
import { AuthService } from '../application/auth.service';
import { LoginDto } from '../dto/login.dto';
import { Public } from '../../../common/auth/public.decorator';
import { CurrentUser } from '../../../common/auth/current-user.decorator';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  // Stricter limit on login to blunt credential brute-force (spec §66).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive a JWT access token' })
  login(@Body() dto: LoginDto, @Ip() ip: string): Promise<LoginResult> {
    return this.authService.login(dto.email, dto.password, ip);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated principal' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
