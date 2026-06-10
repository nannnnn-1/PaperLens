import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ParseCallbackDto } from "./dto/parse-callback.dto";
import { AnnotationType, Prisma } from "@prisma/client";

function vec(arr?: number[]) {
  if (!arr || arr.length === 0) return undefined;
  return `[${arr.join(",")}]`;
}

function asJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class ParseService {
  private readonly logger = new Logger(ParseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleCallback(dto: ParseCallbackDto) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: dto.paperId },
    });
    if (!paper) {
      throw new NotFoundException("论文不存在");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.semanticBlock.deleteMany({ where: { paperId: dto.paperId } });
      await tx.annotation.deleteMany({ where: { paperId: dto.paperId } });
      await tx.figure.deleteMany({ where: { paperId: dto.paperId } });
      await tx.methodCard.deleteMany({ where: { paperId: dto.paperId } });

      const blocks = dto.result.blocks ?? [];
      const annotations = dto.result.annotations ?? [];
      const figures = dto.result.figures ?? [];
      const methodCards = dto.result.methodCards ?? [];

      if (blocks.length === 0) {
        await tx.paper.update({
          where: { id: dto.paperId },
          data: {
            parseStatus: "PARSED",
            parseError: null,
            updatedAt: new Date(),
          },
        });
        return;
      }

      const createdBlocks = await Promise.all(
        blocks.map((b, idx) =>
          tx.semanticBlock.create({
            data: {
              paperId: dto.paperId,
              blockIndex: typeof b.blockIndex === "number" ? b.blockIndex : idx,
              blockType: b.blockType,
              level: b.level ?? null,
              content: b.content,
              translation: b.translation ?? null,
              pageNumber: b.pageNumber ?? null,
              bbox: asJson(b.bbox) ?? null,
            },
          }),
        ),
      );

      await Promise.all(
        blocks.map((b, i) => {
          const v = vec(b.embedding);
          if (!v) return Promise.resolve();
          return tx.$executeRawUnsafe(
            `UPDATE semantic_blocks SET embedding = '${v}'::vector WHERE id = '${createdBlocks[i].id}'`,
          );
        }),
      );

      const indexToBlockId = new Map<number, string>();
      createdBlocks.forEach((cb, i) => {
        const idx =
          typeof blocks[i].blockIndex === "number" ? blocks[i].blockIndex : i;
        indexToBlockId.set(idx, cb.id);
      });

      if (annotations.length > 0) {
        await tx.annotation.createMany({
          data: annotations.map((a) => ({
            paperId: dto.paperId,
            blockId:
              a.blockIndex != null
                ? (indexToBlockId.get(a.blockIndex) ?? null)
                : null,
            type: a.type as AnnotationType,
            text: a.text,
            label: a.label ?? null,
            definition: a.definition ?? null,
            evidence: asJson(a.evidence ?? []),
            createdBy: "AGENT",
          })),
        });
      }

      if (figures.length > 0) {
        await tx.figure.createMany({
          data: figures.map((f) => ({
            paperId: dto.paperId,
            figureIndex: f.figureIndex,
            caption: f.caption ?? null,
            objectKey: f.objectKey ?? "",
            thumbObjectKey: f.thumbObjectKey ?? null,
            aiAnalysis: f.aiAnalysis ?? null,
            pageNumber: f.pageNumber ?? null,
            bbox: asJson(f.bbox) ?? null,
          })),
        });
      }

      if (methodCards.length > 0) {
        await tx.methodCard.createMany({
          data: methodCards.map((m) => ({
            paperId: dto.paperId,
            name: m.name,
            category: m.category ?? null,
            backbone: m.backbone ?? null,
            datasets: asJson(m.datasets ?? []),
            metrics: asJson(m.metrics ?? []),
            paramsCount: m.paramsCount ?? null,
            isCodeAvailable: m.isCodeAvailable ?? null,
            codeUrl: m.codeUrl ?? null,
            evidence: asJson(m.evidence ?? []),
            createdBy: "AGENT",
          })),
        });
      }

      await tx.paper.update({
        where: { id: dto.paperId },
        data: {
          parseStatus: "PARSED",
          parseError: null,
          updatedAt: new Date(),
        },
      });
    });

    await this.prisma.agentLog.create({
      data: {
        paperId: dto.paperId,
        agentType: "PARSER",
        action: "PARSE_CALLBACK",
        inputSummary: `jobId=${dto.jobId}`,
        outputSummary: `blocks=${dto.result.blocks?.length ?? 0}, annotations=${dto.result.annotations?.length ?? 0}, figures=${dto.result.figures?.length ?? 0}, methodCards=${dto.result.methodCards?.length ?? 0}`,
        isSuccess: true,
      },
    });

    this.logger.log(`Parse callback handled for paper ${dto.paperId}`);
    return { received: true };
  }
}
