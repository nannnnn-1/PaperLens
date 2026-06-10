import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { AnnotationQueryDto } from "./dto/annotation-query.dto";
import { CreateAnnotationDto } from "./dto/create-annotation.dto";
import { UpdateMethodCardDto } from "./dto/update-method-card.dto";
import { CreateQADto } from "./dto/create-qa.dto";
import { QAFeedbackDto } from "./dto/qa-feedback.dto";
import { CreateNoteDto } from "./dto/create-note.dto";
import { UpdateNoteDto } from "./dto/update-note.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly ai: AiGatewayService,
  ) {}

  private async ensurePaperAccess(userId: string, paperId: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
    });
    if (!paper || paper.deletedAt) throw new NotFoundException("论文不存在");
    if (paper.userId !== userId) throw new ForbiddenException("无权访问");
    return paper;
  }

  async listBlocks(paperId: string, userId: string, query: PaginationQueryDto) {
    await this.ensurePaperAccess(userId, paperId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.semanticBlock.findMany({
        where: { paperId },
        orderBy: { blockIndex: "asc" },
        skip,
        take: limit,
      }),
      this.prisma.semanticBlock.count({ where: { paperId } }),
    ]);

    return {
      list: rows.map((b) => this.toBlock(b)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBlock(paperId: string, blockId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const block = await this.prisma.semanticBlock.findFirst({
      where: { id: blockId, paperId },
    });
    if (!block) throw new NotFoundException("语义块不存在");
    return this.toBlock(block);
  }

  async listAnnotations(
    paperId: string,
    userId: string,
    query: AnnotationQueryDto,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const where: Prisma.AnnotationWhereInput = { paperId };
    if (query.type) where.type = query.type;
    const rows = await this.prisma.annotation.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
    return { list: rows.map((a) => this.toAnnotation(a)) };
  }

  async createAnnotation(
    paperId: string,
    userId: string,
    dto: CreateAnnotationDto,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const annotation = await this.prisma.annotation.create({
      data: {
        paperId,
        blockId: dto.blockId ?? null,
        type: dto.type,
        text: dto.text,
        label: dto.label ?? null,
        definition: dto.definition ?? null,
        evidence: (dto.evidence ?? []) as Prisma.InputJsonValue,
        createdBy: "USER",
        userId,
      },
    });
    return this.toAnnotation(annotation);
  }

  async removeAnnotation(
    paperId: string,
    annotationId: string,
    userId: string,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const annotation = await this.prisma.annotation.findFirst({
      where: { id: annotationId, paperId },
    });
    if (!annotation) throw new NotFoundException("标注不存在");
    if (annotation.createdBy !== "USER") {
      throw new UnprocessableEntityException("Agent 标注不可删除，请使用纠正");
    }
    await this.prisma.annotation.delete({ where: { id: annotationId } });
    return { success: true };
  }

  async listFigures(paperId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const rows = await this.prisma.figure.findMany({
      where: { paperId },
      orderBy: { figureIndex: "asc" },
    });
    return {
      list: rows.map((f) => ({
        id: f.id,
        figureIndex: f.figureIndex,
        caption: f.caption ?? undefined,
        captionTranslated: f.captionTranslated ?? undefined,
        thumbUrl: f.thumbObjectKey
          ? this.files.getPublicUrl(f.thumbObjectKey)
          : this.files.getPublicUrl(f.objectKey),
        aiAnalysis: f.aiAnalysis ?? undefined,
        pageNumber: f.pageNumber ?? undefined,
      })),
    };
  }

  async getFigure(paperId: string, figureId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const f = await this.prisma.figure.findFirst({
      where: { id: figureId, paperId },
    });
    if (!f) throw new NotFoundException("图表不存在");
    return {
      id: f.id,
      figureIndex: f.figureIndex,
      caption: f.caption ?? undefined,
      captionTranslated: f.captionTranslated ?? undefined,
      thumbUrl: f.thumbObjectKey
        ? this.files.getPublicUrl(f.thumbObjectKey)
        : this.files.getPublicUrl(f.objectKey),
      imageUrl: this.files.getPublicUrl(f.objectKey),
      aiAnalysis: f.aiAnalysis ?? undefined,
      pageNumber: f.pageNumber ?? undefined,
      bbox: f.bbox ?? undefined,
    };
  }

  async figureImageRedirect(
    paperId: string,
    figureId: string,
    userId: string,
    size: "original" | "thumb" = "original",
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const f = await this.prisma.figure.findFirst({
      where: { id: figureId, paperId },
    });
    if (!f) throw new NotFoundException("图表不存在");
    const objectKey =
      size === "thumb" && f.thumbObjectKey ? f.thumbObjectKey : f.objectKey;
    const { presignedUrl } = await this.files.presignDownload(objectKey);
    return { presignedUrl };
  }

  async listMethodCards(paperId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const rows = await this.prisma.methodCard.findMany({
      where: { paperId },
      orderBy: { createdAt: "asc" },
    });
    return { list: rows.map((m) => this.toMethodCard(m)) };
  }

  async updateMethodCard(
    paperId: string,
    cardId: string,
    userId: string,
    dto: UpdateMethodCardDto,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const existing = await this.prisma.methodCard.findFirst({
      where: { id: cardId, paperId },
    });
    if (!existing) throw new NotFoundException("方法卡片不存在");

    const updated = await this.prisma.methodCard.update({
      where: { id: cardId },
      data: {
        name: dto.name,
        metrics: dto.metrics as Prisma.InputJsonValue,
        evidence: dto.evidence as Prisma.InputJsonValue,
        createdBy: "USER",
        userId,
      },
    });
    return this.toMethodCard(updated);
  }

  async listQAs(paperId: string, userId: string, sessionId?: string) {
    await this.ensurePaperAccess(userId, paperId);
    const where: Prisma.PaperQAWhereInput = { paperId, userId };
    if (sessionId) where.sessionId = sessionId;

    const rows = await this.prisma.paperQA.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    const sessions = await this.prisma.paperQA.groupBy({
      by: ["sessionId"],
      where: { paperId, userId },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
    });

    return {
      list: rows.map((q) => this.toQA(q)),
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        lastMessageAt: (s._max.createdAt ?? new Date()).toISOString(),
      })),
    };
  }

  async createQA(paperId: string, userId: string, dto: CreateQADto) {
    await this.ensurePaperAccess(userId, paperId);
    const sessionId = dto.sessionId || randomUUID();

    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
    });
    const blocks = dto.surroundingBlockIds?.length
      ? await this.prisma.semanticBlock.findMany({
          where: { id: { in: dto.surroundingBlockIds } },
          orderBy: { blockIndex: "asc" },
        })
      : [];

    const contextParts: string[] = [];
    contextParts.push(`论文标题：${paper?.title ?? ""}`);
    if (paper?.abstract) contextParts.push(`摘要：${paper.abstract}`);
    if (dto.selectedText)
      contextParts.push(`用户选中内容：${dto.selectedText}`);
    if (blocks.length) {
      contextParts.push(
        "相关段落：\n" + blocks.map((b) => b.content).join("\n"),
      );
    }

    const messages = [
      {
        role: "system",
        content: "你是一位学术助手，基于论文上下文回答问题，优先使用中文。",
      },
      {
        role: "user",
        content: `${contextParts.join("\n\n")}\n\n问题：${dto.question}`,
      },
    ];

    const aiRes = await this.ai.chat(messages, false);
    const answer =
      typeof aiRes === "object" && "reply" in aiRes
        ? (aiRes as { reply: string }).reply
        : String(aiRes);

    const qa = await this.prisma.paperQA.create({
      data: {
        paperId,
        userId,
        sessionId,
        question: dto.question,
        answer,
        context: {
          selectedText: dto.selectedText,
          surroundingBlockIds: dto.surroundingBlockIds,
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.agentLog.create({
      data: {
        paperId,
        userId,
        agentType: "CHAT",
        action: "ANSWER_PAPER",
        inputSummary: dto.question.slice(0, 200),
        outputSummary: answer.slice(0, 200),
        isSuccess: true,
      },
    });

    return {
      answer,
      sessionId,
      citations: [],
      qa: this.toQA(qa),
    };
  }

  async qaFeedback(
    paperId: string,
    qaId: string,
    userId: string,
    dto: QAFeedbackDto,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const qa = await this.prisma.paperQA.findFirst({
      where: { id: qaId, paperId, userId },
    });
    if (!qa) throw new NotFoundException("问答不存在");

    await this.prisma.paperQA.update({
      where: { id: qaId },
      data: {
        isHelpful: dto.isHelpful,
        correction: dto.correction ?? null,
      },
    });
    return { success: true };
  }

  async listNotes(paperId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const rows = await this.prisma.note.findMany({
      where: { paperId, userId },
      orderBy: { createdAt: "desc" },
    });
    return { list: rows.map((n) => this.toNote(n)) };
  }

  async createNote(paperId: string, userId: string, dto: CreateNoteDto) {
    await this.ensurePaperAccess(userId, paperId);
    const note = await this.prisma.note.create({
      data: {
        paperId,
        userId,
        blockId: dto.blockId ?? null,
        content: dto.content,
        color: dto.color ?? "YELLOW",
      },
    });
    return this.toNote(note);
  }

  async updateNote(
    paperId: string,
    noteId: string,
    userId: string,
    dto: UpdateNoteDto,
  ) {
    await this.ensurePaperAccess(userId, paperId);
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, paperId, userId },
    });
    if (!note) throw new NotFoundException("笔记不存在");
    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        content: dto.content,
        color: dto.color,
      },
    });
    return this.toNote(updated);
  }

  async removeNote(paperId: string, noteId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, paperId, userId },
    });
    if (!note) throw new NotFoundException("笔记不存在");
    await this.prisma.note.delete({ where: { id: noteId } });
    return { success: true };
  }

  async getOutline(paperId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const headings = await this.prisma.semanticBlock.findMany({
      where: { paperId, blockType: "HEADING" },
      orderBy: { blockIndex: "asc" },
    });

    const root: {
      id: string;
      blockId: string;
      title: string;
      level: number;
      children?: typeof root;
    }[] = [];
    const stack: typeof root = [];

    for (const h of headings) {
      const node = {
        id: h.id,
        blockId: h.id,
        title: h.content,
        level: h.level ?? 1,
        children: [] as typeof root,
      };

      while (
        stack.length > 0 &&
        (stack[stack.length - 1].level ?? 1) >= node.level
      ) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children!.push(node);
      }
      stack.push(node);
    }

    return { chapters: root };
  }

  async getArchive(paperId: string, userId: string) {
    await this.ensurePaperAccess(userId, paperId);
    const [methodCards, qaCount, noteCount, annotationCount, agentLogs] =
      await Promise.all([
        this.prisma.methodCard.findMany({ where: { paperId } }),
        this.prisma.paperQA.count({ where: { paperId, userId } }),
        this.prisma.note.count({ where: { paperId, userId } }),
        this.prisma.annotation.count({ where: { paperId } }),
        this.prisma.agentLog.findMany({
          where: { paperId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

    return {
      paperId,
      methodCards: methodCards.map((m) => this.toMethodCard(m)),
      qaCount,
      noteCount,
      annotationCount,
      agentLogs: agentLogs.map((l) => ({
        agentType: l.agentType,
        action: l.action,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  private toBlock(b: {
    id: string;
    blockIndex: number;
    blockType: string;
    level: number | null;
    content: string;
    translation: string | null;
    pageNumber: number | null;
    bbox: Prisma.JsonValue;
  }) {
    return {
      id: b.id,
      blockIndex: b.blockIndex,
      blockType: b.blockType,
      level: b.level ?? undefined,
      content: b.content,
      translation: b.translation ?? undefined,
      pageNumber: b.pageNumber ?? undefined,
      bbox:
        (b.bbox as
          | { x: number; y: number; w: number; h: number }
          | undefined) ?? undefined,
    };
  }

  private toAnnotation(a: {
    id: string;
    type: string;
    text: string;
    label: string | null;
    definition: string | null;
    evidence: Prisma.JsonValue;
    createdBy: string;
    userId: string | null;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      type: a.type,
      text: a.text,
      label: a.label ?? undefined,
      definition: a.definition ?? undefined,
      evidence: (a.evidence as unknown[]) ?? undefined,
      createdBy: a.createdBy,
      userId: a.userId ?? undefined,
      createdAt: a.createdAt.toISOString(),
    };
  }

  private toMethodCard(m: {
    id: string;
    name: string;
    category: string | null;
    backbone: string | null;
    datasets: Prisma.JsonValue;
    metrics: Prisma.JsonValue;
    paramsCount: string | null;
    isCodeAvailable: boolean | null;
    codeUrl: string | null;
    evidence: Prisma.JsonValue;
    createdBy: string;
  }) {
    return {
      id: m.id,
      name: m.name,
      category: m.category ?? undefined,
      backbone: m.backbone ?? undefined,
      datasets: (m.datasets as unknown[]) ?? [],
      metrics: (m.metrics as unknown[]) ?? [],
      paramsCount: m.paramsCount ?? undefined,
      isCodeAvailable: m.isCodeAvailable ?? undefined,
      codeUrl: m.codeUrl ?? undefined,
      evidence: (m.evidence as unknown[]) ?? [],
      createdBy: m.createdBy,
    };
  }

  private toQA(q: {
    id: string;
    sessionId: string;
    question: string;
    answer: string;
    context: Prisma.JsonValue;
    isHelpful: boolean | null;
    correction: string | null;
    createdAt: Date;
  }) {
    return {
      id: q.id,
      sessionId: q.sessionId,
      question: q.question,
      answer: q.answer,
      context:
        (q.context as
          | { selectedText?: string; surroundingBlockIds?: string[] }
          | undefined) ?? undefined,
      isHelpful: q.isHelpful ?? undefined,
      correction: q.correction ?? undefined,
      createdAt: q.createdAt.toISOString(),
    };
  }

  private toNote(n: {
    id: string;
    content: string;
    blockId: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: n.id,
      content: n.content,
      blockId: n.blockId ?? undefined,
      color: n.color,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }
}
