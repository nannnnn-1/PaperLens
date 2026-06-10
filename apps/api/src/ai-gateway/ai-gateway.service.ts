import { Injectable, Inject, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { firstValueFrom } from "rxjs";
import { REDIS_CLIENT } from "../config/redis.provider";

export interface ParseJob {
  jobId: string;
  paperId: string;
  fileUrl: string;
  objectKey: string;
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.baseUrl = this.config.get<string>(
      "AI_SERVICE_BASE_URL",
      "http://localhost:8000/api/v1",
    );
  }

  async pushParseJob(paperId: string, fileUrl: string, objectKey: string): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = JSON.stringify({ jobId, paperId, fileUrl, objectKey });
    await this.redis.lpush("parse:queue", payload);
    this.logger.log(`Parse job pushed: ${jobId} for paper ${paperId}`);
    return jobId;
  }

  async submitParseJob(
    paperId: string,
    fileUrl: string,
  ): Promise<{ jobId: string }> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ jobId: string }>(`${this.baseUrl}/parse`, {
          paper_id: paperId,
          file_url: fileUrl,
        }),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI parse submit failed: ${(err as Error).message}`);
      const jobId = await this.pushParseJob(paperId, fileUrl);
      return { jobId };
    }
  }

  async translateBlocks(blocks: string[], targetLang = "zh") {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ translations: string[] }>(
          `${this.baseUrl}/translate`,
          { blocks, target_lang: targetLang },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI translate failed: ${(err as Error).message}`);
      return { translations: blocks.map(() => "") };
    }
  }

  async extractTerms(text: string, context?: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{
          terms: Array<{
            term: string;
            definition: string;
            category?: string;
            aliases?: string[];
          }>;
        }>(`${this.baseUrl}/terms/extract`, { text, context }),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI terms extract failed: ${(err as Error).message}`);
      return { terms: [] };
    }
  }

  async analyzeFigure(imageUrl: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ analysis: string }>(
          `${this.baseUrl}/figures/analyze`,
          { image_url: imageUrl },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI figure analyze failed: ${(err as Error).message}`);
      return { analysis: "" };
    }
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    stream = false,
  ) {
    try {
      if (stream) {
        const response = await firstValueFrom(
          this.http.post(
            `${this.baseUrl}/chat`,
            { messages, stream: true },
            { responseType: "stream" },
          ),
        );
        return response.data as NodeJS.ReadableStream;
      }
      const { data } = await firstValueFrom(
        this.http.post<{ reply: string; citations?: unknown[] }>(
          `${this.baseUrl}/chat`,
          { messages, stream: false },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI chat failed: ${(err as Error).message}`);
      return { reply: "AI 服务暂时不可用", citations: [] };
    }
  }

  async generateEmbeddings(texts: string[]) {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ embeddings: number[][] }>(
          `${this.baseUrl}/embeddings`,
          { texts },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI embeddings failed: ${(err as Error).message}`);
      return { embeddings: texts.map(() => new Array(1536).fill(0)) };
    }
  }

  async semanticSearch(
    queryEmbedding: number[],
    topK = 5,
    filters?: Record<string, unknown>,
  ) {
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ results: unknown[] }>(
          `${this.baseUrl}/search/semantic`,
          { query_embedding: queryEmbedding, top_k: topK, filters },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`AI semantic search failed: ${(err as Error).message}`);
      return { results: [] };
    }
  }
}
