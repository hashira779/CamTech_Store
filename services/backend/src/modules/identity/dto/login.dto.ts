import { IsEmail, IsString, MinLength } from 'class-validator';

/** Login payload (mirrors contracts `loginSchema`, validated at the edge). */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
