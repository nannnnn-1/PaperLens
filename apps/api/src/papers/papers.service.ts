import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { CreatePaperDto } from "./dto/create-paper.dto";
import { UploadCompleteDto } from "./dto/upload-complete.dto";
import { UpdateProgressDto } from "./dto/update-progress.dto";
import { FavoriteDto } from "./dto/favorite.dto";
import { TranslatePaperDto } from "./dto/translate-paper.dto";
import { PaperListQueryDto } from "./dto/paper-list-query.dto";
import { Prisma, Paper } from "@prisma/client";

function asJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class PapersService {
  private readonly logger = new Logger(PapersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly ai: AiGatewayService,
  ) {}

  async list(userId: string, query: PaperListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PaperWhereInput = {
      userId,
      deletedAt: null,
    };

    if (query.status) {
      where.parseStatus = query.status as Prisma.EnumParseStatusFilter;
    }
    if (query.favorite === "true") {
      where.isFavorite = true;
    } else if (query.favorite === "false") {
      where.isFavorite = false;
    }

    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { abstract: { contains: term, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.paper.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.paper.count({ where }),
    ]);

    return {
      list: rows.map((p) => this.toMeta(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(userId: string, dto: CreatePaperDto) {
    const paper = await this.prisma.paper.create({
      data: {
        userId,
        title: dto.title,
        authors: asJson(dto.authors),
        abstract: dto.abstract ?? null,
        sourceType: dto.arxivId ? "ARXIV" : "MANUAL",
        sourceUrl: dto.sourceUrl ?? null,
        arxivId: dto.arxivId ?? null,
        parseStatus: "PARSED",
      },
    });
    return this.toMeta(paper);
  }

  async findOne(userId: string, id: string) {
    const paper = await this.prisma.paper.findUnique({ where: { id } });
    if (!paper || paper.deletedAt) throw new NotFoundException("论文不存在");
    if (paper.userId !== userId) throw new ForbiddenException("无权访问");
    return this.toDetail(paper);
  }

  async remove(userId: string, id: string) {
    const paper = await this.prisma.paper.findUnique({ where: { id } });
    if (!paper || paper.deletedAt) throw new NotFoundException("论文不存在");
    if (paper.userId !== userId) throw new ForbiddenException("无权访问");

    await this.prisma.paper.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async uploadComplete(userId: string, dto: UploadCompleteDto) {
    const paper = await this.prisma.paper.create({
      data: {
        userId,
        title: dto.filename,
        authors: [],
        sourceType: "UPLOAD",
        parseStatus: "UPLOADED",
        fileInfo: {
          bucket: this.files.getBucket(),
          objectKey: dto.objectKey,
          fileSize: dto.size,
          mimeType: dto.mimeType,
        } as Prisma.InputJsonValue,
      },
    });

    const { presignedUrl: fileUrl } = await this.files.presignDownload(dto.objectKey);
    const jobId = await this.ai.pushParseJob(paper.id, fileUrl, dto.objectKey);

    await this.prisma.paper.update({
      where: { id: paper.id },
      data: { parseStatus: "QUEUED" },
    });

    return { paper: this.toMeta(paper), jobId };
  }

  async downloadRedirect(userId: string, id: string) {
    const paper = await this.findRaw(userId, id);
    const info = (paper.fileInfo ?? {}) as { objectKey?: string };
    if (!info.objectKey) throw new NotFoundException("文件不存在");
    const { presignedUrl } = await this.files.presignDownload(info.objectKey);
    return { presignedUrl };
  }

  async reparse(userId: string, id: string) {
    const paper = await this.findRaw(userId, id);
    const info = (paper.fileInfo ?? {}) as { objectKey?: string };
    if (!info.objectKey) throw new UnprocessableEntityException("无文件可解析");

    const { presignedUrl: fileUrl } = await this.files.presignDownload(info.objectKey);
    const jobId = await this.ai.pushParseJob(id, fileUrl, info.objectKey);

    await this.prisma.paper.update({
      where: { id },
      data: { parseStatus: "QUEUED", parseError: null },
    });

    return { jobId };
  }

  async translate(userId: string, id: string, dto: TranslatePaperDto) {
    const paper = await this.findRaw(userId, id);
    if (paper.parseStatus !== "PARSED") {
      throw new UnprocessableEntityException("论文解析完成前不可翻译");
    }

    const targetLang = dto.targetLang ?? "zh";
    const blocks = await this.prisma.semanticBlock.findMany({
      where: { paperId: id, translation: null },
      orderBy: { blockIndex: "asc" },
    });

    if (blocks.length > 0) {
      const contents = blocks.map((b) => b.content);
      const { translations } = await this.ai.translateBlocks(
        contents,
        targetLang,
      );
      await this.prisma.$transaction(
        blocks.map((b, i) =>
          this.prisma.semanticBlock.update({
            where: { id: b.id },
            data: { translation: translations[i] ?? "" },
          }),
        ),
      );

      await this.prisma.agentLog.create({
        data: {
          paperId: id,
          userId,
          agentType: "TRANSLATOR",
          action: "TRANSLATE_BLOCKS",
          inputSummary: `blocks=${blocks.length}, target=${targetLang}`,
          outputSummary: `translated=${translations.length}`,
          isSuccess: true,
        },
      });
    }

    return { paperId: id, status: "DONE" };
  }

  async updateProgress(userId: string, id: string, dto: UpdateProgressDto) {
    await this.findRaw(userId, id);
    const updated = await this.prisma.paper.update({
      where: { id },
      data: { readingProgress: dto.progress },
    });
    return this.toMeta(updated);
  }

  async favorite(userId: string, id: string, dto: FavoriteDto) {
    await this.findRaw(userId, id);
    const updated = await this.prisma.paper.update({
      where: { id },
      data: { isFavorite: dto.isFavorite },
    });
    return this.toMeta(updated);
  }

  private async findRaw(userId: string, id: string) {
    const paper = await this.prisma.paper.findUnique({ where: { id } });
    if (!paper || paper.deletedAt) throw new NotFoundException("论文不存在");
    if (paper.userId !== userId) throw new ForbiddenException("无权访问");
    return paper;
  }

  private toMeta(paper: Paper) {
    return {
      id: paper.id,
      title: paper.title,
      titleTranslated: paper.titleTranslated ?? undefined,
      authors:
        (paper.authors as Array<{ name: string; affiliation?: string }>) ?? [],
      sourceType: paper.sourceType,
      sourceUrl: paper.sourceUrl ?? undefined,
      arxivId: paper.arxivId ?? undefined,
      parseStatus: paper.parseStatus,
      parseError: paper.parseError ?? undefined,
      readingProgress: paper.readingProgress,
      isFavorite: paper.isFavorite,
      createdAt: paper.createdAt.toISOString(),
    };
  }

  private toDetail(paper: Paper) {
    const info = (paper.fileInfo ?? {}) as {
      objectKey?: string;
      fileSize?: number;
      mimeType?: string;
    };
    return {
      ...this.toMeta(paper),
      abstract: paper.abstract ?? undefined,
      abstractTranslated: paper.abstractTranslated ?? undefined,
      doi: paper.doi ?? undefined,
      publishedAt: paper.publishedAt?.toISOString(),
      fileInfo: {
        objectKey: info.objectKey ?? "",
        fileSize: info.fileSize ?? 0,
        mimeType: info.mimeType ?? "",
      },
      methodSummary:
        (paper.methodSummary as { methods?: unknown[] } | undefined) ??
        undefined,
    };
  }
}
