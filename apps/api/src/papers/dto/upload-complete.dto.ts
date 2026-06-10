import { IsString, IsNumber } from "class-validator";

export class UploadCompleteDto {
  @IsString()
  objectKey: string;

  @IsString()
  filename: string;

  @IsNumber()
  size: number;

  @IsString()
  mimeType: string;
}
