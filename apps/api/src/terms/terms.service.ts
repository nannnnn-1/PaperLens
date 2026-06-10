import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { TermListQueryDto } from "./dto/term-list-query.dto";
import { CreateTermDto } from "./dto/create-term.dto";
import { SemanticSearchDto } from "./dto/semantic-search.dto";
import { REDIS_CLIENT } from "../config/redis.provider";
import { Prisma } from "@prisma/client";

function vec(arr: number[]) {
  return `[${arr.join(",")}]`;
}

@Injectable()
export class TermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private cacheKey(term: string) {
    return `term:${term.toLowerCase()}`;
  }

  private ttlSeconds = 60 * 60;

  async search(query: TermListQueryDto) {
    const q = query.q?.trim().toLowerCase();
    const where: Prisma.TermDefinitionWhereInput = {};
    if (query.type)
      where.category = query.type as Prisma.EnumAnnotationTypeNullableFilter;

    if (q) {
      where.OR = [
        { term: { startsWith: q, mode: "insensitive" } },
        { aliases: { array_contains: q } },
      ];
    }

    const rows = await this.prisma.termDefinition.findMany({
      where,
      orderBy: { usageCount: "desc" },
      take: 50,
    });

    return {
      list: rows.map((t) => this.toTerm(t)),
    };
  }

  async findOne(termParam: string) {
    const term = decodeURIComponent(termParam).trim().toLowerCase();

    const cached = await this.redis.get(this.cacheKey(term));
    if (cached) {
      return JSON.parse(cached);
    }

    const def = await this.prisma.termDefinition.findFirst({
      where: {
        OR: [
          { term: { equals: term, mode: "insensitive" } },
          { aliases: { array_contains: term } },
        ],
      },
    });

    if (def) {
      const result = this.toTerm(def);
      await this.redis.setex(
        this.cacheKey(term),
        this.ttlSeconds,
        JSON.stringify(result),
      );
      return result;
    }

    const extracted = await this.ai.extractTerms(term);
    if (extracted.terms && extracted.terms.length > 0) {
      const first = extracted.terms[0];
      const created = await this.prisma.termDefinition.create({
        data: {
          term: first.term || term,
          definition: first.definition || "暂无定义",
          category: (first.category as never) ?? null,
          aliases: (first.aliases ?? []) as never,
        },
      });
      const result = this.toTerm(created);
      await this.redis.setex(
        this.cacheKey(term),
        this.ttlSeconds,
        JSON.stringify(result),
      );
      return result;
    }

    throw new NotFoundException("术语未找到");
  }

  async create(dto: CreateTermDto) {
    const existing = await this.prisma.termDefinition.findUnique({
      where: { term: dto.term },
    });
    if (existing) throw new ConflictException("术语已存在");

    const created = await this.prisma.termDefinition.create({
      data: {
        term: dto.term,
        definition: dto.definition,
        category: dto.category ?? null,
        aliases: (dto.aliases ?? []) as never,
      },
    });
    return this.toTerm(created);
  }

  async semanticSearch(dto: SemanticSearchDto) {
    const { embeddings } = await this.ai.generateEmbeddings([dto.query]);
    if (!embeddings || embeddings.length === 0) {
      return { list: [] };
    }
    const vector = vec(embeddings[0]);
    const topK = dto.topK ?? 5;

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT id, term, definition, category, aliases, usage_count, embedding <=> '${vector}'::vector AS distance
       FROM term_definitions
       ORDER BY embedding <=> '${vector}'::vector
       LIMIT ${topK}`,
    )) as Array<{
      id: string;
      term: string;
      definition: string;
      category: string | null;
      aliases: string[];
      usage_count: number;
      distance: number;
    }>;

    return {
      list: rows.map((t) => ({
        id: t.id,
        term: t.term,
        definition: t.definition,
        category: t.category ?? undefined,
        aliases: t.aliases ?? [],
        usageCount: t.usage_count,
      })),
    };
  }

  private toTerm(t: {
    id: string;
    term: string;
    definition: string;
    category: string | null;
    aliases: unknown;
    usageCount: number;
  }) {
    return {
      id: t.id,
      term: t.term,
      definition: t.definition,
      category: t.category ?? undefined,
      aliases: (t.aliases as string[]) ?? [],
      usageCount: t.usageCount,
    };
  }
}
