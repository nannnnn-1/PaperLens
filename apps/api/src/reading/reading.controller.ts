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
  Redirect,
} from "@nestjs/common";
import { SkipTransform } from "../common/decorators/skip-transform.decorator";
import { ReadingService } from "./reading.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  RequestUser,
} from "../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { AnnotationQueryDto } from "./dto/annotation-query.dto";
import { CreateAnnotationDto } from "./dto/create-annotation.dto";
import { UpdateMethodCardDto } from "./dto/update-method-card.dto";
import { CreateQADto } from "./dto/create-qa.dto";
import { QAFeedbackDto } from "./dto/qa-feedback.dto";
import { CreateNoteDto } from "./dto/create-note.dto";
import { UpdateNoteDto } from "./dto/update-note.dto";

@Controller("papers/:paperId")
@UseGuards(JwtAuthGuard)
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Get("blocks")
  listBlocks(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.readingService.listBlocks(paperId, user.userId, query);
  }

  @Get("blocks/:blockId")
  getBlock(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("blockId") blockId: string,
  ) {
    return this.readingService.getBlock(paperId, blockId, user.userId);
  }

  @Get("annotations")
  listAnnotations(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Query() query: AnnotationQueryDto,
  ) {
    return this.readingService.listAnnotations(paperId, user.userId, query);
  }

  @Post("annotations")
  createAnnotation(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Body() dto: CreateAnnotationDto,
  ) {
    return this.readingService.createAnnotation(paperId, user.userId, dto);
  }

  @Delete("annotations/:annotationId")
  removeAnnotation(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("annotationId") annotationId: string,
  ) {
    return this.readingService.removeAnnotation(
      paperId,
      annotationId,
      user.userId,
    );
  }

  @Get("figures")
  listFigures(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
  ) {
    return this.readingService.listFigures(paperId, user.userId);
  }

  @Get("figures/:figureId")
  getFigure(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("figureId") figureId: string,
  ) {
    return this.readingService.getFigure(paperId, figureId, user.userId);
  }

  @Get("figures/:figureId/image")
  @Redirect()
  @SkipTransform()
  async figureImage(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("figureId") figureId: string,
    @Query("size") size?: string,
  ) {
    const { presignedUrl } = await this.readingService.figureImageRedirect(
      paperId,
      figureId,
      user.userId,
      size === "thumb" ? "thumb" : "original",
    );
    return { url: presignedUrl };
  }

  @Get("method-cards")
  listMethodCards(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
  ) {
    return this.readingService.listMethodCards(paperId, user.userId);
  }

  @Patch("method-cards/:cardId")
  updateMethodCard(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("cardId") cardId: string,
    @Body() dto: UpdateMethodCardDto,
  ) {
    return this.readingService.updateMethodCard(
      paperId,
      cardId,
      user.userId,
      dto,
    );
  }

  @Get("qas")
  listQAs(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Query("sessionId") sessionId?: string,
  ) {
    return this.readingService.listQAs(paperId, user.userId, sessionId);
  }

  @Post("qas")
  createQA(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Body() dto: CreateQADto,
  ) {
    return this.readingService.createQA(paperId, user.userId, dto);
  }

  @Post("qas/:qaId/feedback")
  qaFeedback(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("qaId") qaId: string,
    @Body() dto: QAFeedbackDto,
  ) {
    return this.readingService.qaFeedback(paperId, qaId, user.userId, dto);
  }

  @Get("notes")
  listNotes(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
  ) {
    return this.readingService.listNotes(paperId, user.userId);
  }

  @Post("notes")
  createNote(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.readingService.createNote(paperId, user.userId, dto);
  }

  @Patch("notes/:noteId")
  updateNote(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("noteId") noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.readingService.updateNote(paperId, noteId, user.userId, dto);
  }

  @Delete("notes/:noteId")
  removeNote(
    @CurrentUser() user: RequestUser,
    @Param("paperId") paperId: string,
    @Param("noteId") noteId: string,
  ) {
    return this.readingService.removeNote(paperId, noteId, user.userId);
  }

  @Get("outline")
  outline(@CurrentUser() user: RequestUser, @Param("paperId") paperId: string) {
    return this.readingService.getOutline(paperId, user.userId);
  }

  @Get("archive")
  archive(@CurrentUser() user: RequestUser, @Param("paperId") paperId: string) {
    return this.readingService.getArchive(paperId, user.userId);
  }
}
