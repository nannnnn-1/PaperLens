import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { ChatPaperDto } from "./dto/chat-paper.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
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

  async chatPaper(userId: string, dto: ChatPaperDto) {
    const paper = await this.ensurePaperAccess(userId, dto.paperId);
    const sessionId = dto.sessionId || randomUUID();

    const blocks = dto.surroundingBlockIds?.length
      ? await this.prisma.semanticBlock.findMany({
          where: { id: { in: dto.surroundingBlockIds } },
          orderBy: { blockIndex: "asc" },
        })
      : [];

    const contextParts: string[] = [];
    contextParts.push(`论文标题：${paper.title ?? ""}`);
    if (paper.abstract) contextParts.push(`摘要：${paper.abstract}`);
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

    if (dto.stream) {
      return { stream: true, messages, sessionId };
    }

    const aiRes = await this.ai.chat(messages, false);
    const answer =
      typeof aiRes === "object" && "reply" in aiRes
        ? (aiRes as { reply: string }).reply
        : String(aiRes);

    await this.prisma.paperQA.create({
      data: {
        paperId: dto.paperId,
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
        paperId: dto.paperId,
        userId,
        agentType: "CHAT",
        action: "ANSWER_PAPER",
        inputSummary: dto.question.slice(0, 200),
        outputSummary: answer.slice(0, 200),
        isSuccess: true,
      },
    });

    return { reply: answer, sessionId, citations: [] };
  }
}
