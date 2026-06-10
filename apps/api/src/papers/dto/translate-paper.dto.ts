import { IsOptional, IsString } from "class-validator";

export class TranslatePaperDto {
  @IsOptional()
  @IsString()
  targetLang?: string;
}
