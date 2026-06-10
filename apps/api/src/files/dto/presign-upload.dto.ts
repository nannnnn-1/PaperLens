import { IsString, IsNumber, IsOptional } from "class-validator";

export class PresignUploadDto {
  @IsString()
  filename: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  size: number;

  @IsOptional()
  @IsString()
  paperId?: string;
}
