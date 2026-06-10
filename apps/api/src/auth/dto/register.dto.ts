import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: "密码长度至少 8 位" })
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
