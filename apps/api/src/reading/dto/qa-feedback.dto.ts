import { IsBoolean, IsOptional, IsString } from "class-validator";

export class QAFeedbackDto {
  @IsBoolean()
  isHelpful: boolean;

  @IsOptional()
  @IsString()
  correction?: string;
}
