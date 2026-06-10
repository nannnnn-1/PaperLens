import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  pushMorning?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEvening?: boolean;

  @IsOptional()
  @IsBoolean()
  pushInstant?: boolean;

  @IsOptional()
  @IsString()
  languageUi?: string;
}
