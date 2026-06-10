import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Redirect,
} from "@nestjs/common";
import { SkipTransform } from "../common/decorators/skip-transform.decorator";
import { PapersService } from "./papers.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  RequestUser,
} from "../common/decorators/current-user.decorator";
import { CreatePaperDto } from "./dto/create-paper.dto";
import { UploadCompleteDto } from "./dto/upload-complete.dto";
import { UpdateProgressDto } from "./dto/update-progress.dto";
import { FavoriteDto } from "./dto/favorite.dto";
import { TranslatePaperDto } from "./dto/translate-paper.dto";
import { PaperListQueryDto } from "./dto/paper-list-query.dto";

@Controller("papers")
@UseGuards(JwtAuthGuard)
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: PaperListQueryDto) {
    return this.papersService.list(user.userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaperDto) {
    return this.papersService.create(user.userId, dto);
  }

  @Post("upload-complete")
  @HttpCode(HttpStatus.CREATED)
  uploadComplete(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadCompleteDto,
  ) {
    return this.papersService.uploadComplete(user.userId, dto);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.papersService.findOne(user.userId, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.papersService.remove(user.userId, id);
  }

  @Get(":id/download")
  @Redirect()
  @SkipTransform()
  async download(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    const { presignedUrl } = await this.papersService.downloadRedirect(
      user.userId,
      id,
    );
    return { url: presignedUrl };
  }

  @Post(":id/reparse")
  reparse(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.papersService.reparse(user.userId, id);
  }

  @Post(":id/translate")
  translate(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: TranslatePaperDto,
  ) {
    return this.papersService.translate(user.userId, id, dto);
  }

  @Patch(":id/progress")
  updateProgress(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.papersService.updateProgress(user.userId, id, dto);
  }

  @Post(":id/favorite")
  favorite(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: FavoriteDto,
  ) {
    return this.papersService.favorite(user.userId, id, dto);
  }
}
