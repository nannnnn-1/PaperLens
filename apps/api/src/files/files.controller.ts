import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { FilesService } from "./files.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  RequestUser,
} from "../common/decorators/current-user.decorator";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { PresignDownloadDto } from "./dto/presign-download.dto";

@Controller("files")
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("presign-upload")
  presignUpload(
    @CurrentUser() user: RequestUser,
    @Body() dto: PresignUploadDto,
  ) {
    return this.filesService.presignUpload(
      user.userId,
      dto.filename,
      dto.mimeType,
    );
  }

  @Post("presign-download")
  presignDownload(@Body() dto: PresignDownloadDto) {
    return this.filesService.presignDownload(dto.objectKey);
  }
}
