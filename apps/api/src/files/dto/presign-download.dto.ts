import { IsString } from "class-validator";

export class PresignDownloadDto {
  @IsString()
  objectKey: string;
}
