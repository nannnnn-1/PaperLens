import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { AiGatewayService } from "../src/ai-gateway/ai-gateway.service";
import { REDIS_CLIENT } from "../src/config/redis.provider";
import Redis from "ioredis";

describe("PaperLens Phase 1 E2E", () => {
  let app: INestApplication;
  let token: string;
  let paperId: string;
  const ts = Date.now();
  const email = `e2e_${ts}@test.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiGatewayService)
      .useValue({
        generateText: jest.fn(async () => ({
          content: "Mock AI reply",
          sessionId: "mock-session-id",
        })),
        embed: jest.fn(async () => new Array(1536).fill(0.1)),
        pushParseJob: jest.fn(async () => `job_${Date.now()}`),
        chat: jest.fn(async () => ({ reply: "Mock AI reply", citations: [] })),
        translateBlocks: jest.fn(async (blocks: string[]) => ({
          translations: blocks.map(() => ""),
        })),
        extractTerms: jest.fn(async () => ({ terms: [] })),
        analyzeFigure: jest.fn(async () => ({ analysis: "" })),
        generateEmbeddings: jest.fn(async (texts: string[]) => ({
          embeddings: texts.map(() => new Array(1536).fill(0)),
        })),
        semanticSearch: jest.fn(async () => ({ results: [] })),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor(new Reflector()));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    const redis = app.get<Redis>(REDIS_CLIENT);
    await redis.quit();
    await app.close();
  });

  describe("Auth", () => {
    it("POST /auth/register", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ email, password: "password123", displayName: "E2E" })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      token = res.body.data.token;
    });

    it("POST /auth/login", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "password123" })
        .expect(200);

      expect(res.body.data.token).toBeDefined();
    });

    it("POST /auth/refresh", async () => {
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "password123" });

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: login.body.data.refreshToken })
        .expect(200);

      expect(res.body.data.token).toBeDefined();
    });

    it("POST /auth/logout", async () => {
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "password123" });

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .send({ refreshToken: login.body.data.refreshToken })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });
  });

  describe("User", () => {
    it("GET /users/me", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.email).toBe(email);
    });

    it("PATCH /users/me", async () => {
      const res = await request(app.getHttpServer())
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ displayName: "Updated" })
        .expect(200);

      expect(res.body.data.displayName).toBe("Updated");
    });

    it("interests & settings flow", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/users/me/interests")
        .set("Authorization", `Bearer ${token}`)
        .send({ keyword: "AI" })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/api/v1/users/me/interests")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(list.body.data.interests.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .patch("/api/v1/users/me/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ pushMorning: false })
        .expect(200);

      const settings = await request(app.getHttpServer())
        .get("/api/v1/users/me/settings")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(settings.body.data.pushMorning).toBe(false);
    });
  });

  describe("Files", () => {
    it("POST /files/presign-upload", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/files/presign-upload")
        .set("Authorization", `Bearer ${token}`)
        .send({ filename: "test.pdf", mimeType: "application/pdf", size: 1024 })
        .expect(201);

      expect(res.body.data.presignedUrl).toBeDefined();
      expect(res.body.data.objectKey).toBeDefined();
    });

    it("POST /files/presign-download", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/files/presign-download")
        .set("Authorization", `Bearer ${token}`)
        .send({ objectKey: "test/file.pdf" })
        .expect(201);

      expect(res.body.data.presignedUrl).toBeDefined();
    });
  });

  describe("Papers", () => {
    it("POST /papers (manual)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/papers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Test Paper",
          authors: [{ name: "Alice" }],
          abstract: "Abstract here",
          arxivId: "2401.00001",
        })
        .expect(201);

      expect(res.body.data.title).toBe("Test Paper");
      paperId = res.body.data.id;
    });

    it("GET /papers list", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/papers")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    it("GET /papers/:id", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${paperId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(paperId);
    });

    it("POST /papers/upload-complete", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/papers/upload-complete")
        .set("Authorization", `Bearer ${token}`)
        .send({
          objectKey: "uploads/test.pdf",
          filename: "test.pdf",
          size: 1234,
          mimeType: "application/pdf",
        })
        .expect(201);

      expect(res.body.data.paper.id).toBeDefined();
    });

    it("POST /papers/:id/favorite", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/papers/${paperId}/favorite`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isFavorite: true })
        .expect(201);

      expect(res.body.data.isFavorite).toBe(true);
    });

    it("PATCH /papers/:id/progress", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/papers/${paperId}/progress`)
        .set("Authorization", `Bearer ${token}`)
        .send({ progress: 0.5 })
        .expect(200);

      expect(res.body.data.readingProgress).toBe(0.5);
    });
  });

  describe("Parse Callback", () => {
    it("POST /parse/callback", async () => {
      const upload = await request(app.getHttpServer())
        .post("/api/v1/papers/upload-complete")
        .set("Authorization", `Bearer ${token}`)
        .send({
          objectKey: "uploads/parse.pdf",
          filename: "parse.pdf",
          size: 1000,
          mimeType: "application/pdf",
        });

      const pid = upload.body.data.paper.id;

      const res = await request(app.getHttpServer())
        .post("/api/v1/parse/callback")
        .send({
          jobId: `job_${Date.now()}`,
          paperId: pid,
          result: {
            blocks: [
              {
                blockIndex: 0,
                blockType: "HEADING",
                level: 1,
                content: "Intro",
              },
              { blockIndex: 1, blockType: "PARAGRAPH", content: "Body text." },
            ],
            annotations: [{ type: "CONCEPT", text: "body", blockIndex: 1 }],
            figures: [],
            methodCards: [],
          },
        })
        .expect(200);

      expect(res.body.data.received).toBe(true);

      const paper = await request(app.getHttpServer())
        .get(`/api/v1/papers/${pid}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(paper.body.data.parseStatus).toBe("PARSED");
    });
  });

  describe("Reading", () => {
    let readPaperId: string;
    let blockId: string;
    let annotationId: string;
    let noteId: string;

    beforeAll(async () => {
      const up = await request(app.getHttpServer())
        .post("/api/v1/papers/upload-complete")
        .set("Authorization", `Bearer ${token}`)
        .send({
          objectKey: "uploads/read.pdf",
          filename: "read.pdf",
          size: 1000,
          mimeType: "application/pdf",
        });

      readPaperId = up.body.data.paper.id;

      await request(app.getHttpServer())
        .post("/api/v1/parse/callback")
        .send({
          jobId: `job_${Date.now()}`,
          paperId: readPaperId,
          result: {
            blocks: [
              {
                blockIndex: 0,
                blockType: "HEADING",
                level: 1,
                content: "Chapter 1",
              },
              {
                blockIndex: 1,
                blockType: "PARAGRAPH",
                content: "Paragraph one.",
              },
            ],
            annotations: [{ type: "ALGORITHM", text: "CNN", blockIndex: 1 }],
            figures: [
              {
                figureIndex: 1,
                caption: "Fig 1",
                objectKey: "fig1.png",
                thumbObjectKey: "fig1_thumb.png",
              },
            ],
            methodCards: [
              {
                name: "ResNet",
                category: "CV",
                metrics: [{ name: "acc", value: 0.95 }],
              },
            ],
          },
        });
    });

    it("GET blocks", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/blocks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.list.length).toBe(2);
      blockId = res.body.data.list[0].id;
    });

    it("GET single block", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/blocks/${blockId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(blockId);
    });

    it("GET annotations", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/annotations`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.list.length).toBe(1);
      annotationId = res.body.data.list[0].id;
    });

    it("POST annotation", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/papers/${readPaperId}/annotations`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: "CONCEPT", text: "NN", blockId })
        .expect(201);

      expect(res.body.data.text).toBe("NN");
      annotationId = res.body.data.id;
    });

    it("DELETE annotation", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/papers/${readPaperId}/annotations/${annotationId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });

    it("GET figures", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/figures`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.list.length).toBe(1);
    });

    it("GET method-cards", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/method-cards`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.list.length).toBe(1);
    });

    it("PATCH method-card", async () => {
      const cards = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/method-cards`)
        .set("Authorization", `Bearer ${token}`);

      const cardId = cards.body.data.list[0].id;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/papers/${readPaperId}/method-cards/${cardId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ResNet-50" })
        .expect(200);

      expect(res.body.data.name).toBe("ResNet-50");
    });

    it("Q&A flow", async () => {
      const qa = await request(app.getHttpServer())
        .post(`/api/v1/papers/${readPaperId}/qas`)
        .set("Authorization", `Bearer ${token}`)
        .send({ question: "What is this?", surroundingBlockIds: [blockId] })
        .expect(201);

      expect(qa.body.data.answer).toBeDefined();
      expect(qa.body.data.sessionId).toBeDefined();

      const list = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/qas`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(list.body.data.list.length).toBeGreaterThan(0);
    });

    it("Notes flow", async () => {
      const create = await request(app.getHttpServer())
        .post(`/api/v1/papers/${readPaperId}/notes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Important note", blockId })
        .expect(201);

      noteId = create.body.data.id;

      const list = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/notes`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(list.body.data.list.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .patch(`/api/v1/papers/${readPaperId}/notes/${noteId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Updated note" })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/papers/${readPaperId}/notes/${noteId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });

    it("GET outline", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/outline`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.chapters.length).toBe(1);
    });

    it("GET archive", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/papers/${readPaperId}/archive`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.paperId).toBe(readPaperId);
    });
  });

  describe("Chat", () => {
    it("POST /chat/paper", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/chat/paper")
        .set("Authorization", `Bearer ${token}`)
        .send({
          paperId,
          question: "Summary?",
          selectedText: "Abstract here",
        })
        .expect(201);

      expect(res.body.data.reply).toBeDefined();
      expect(res.body.data.sessionId).toBeDefined();
    });
  });

  describe("Terms", () => {
    const termName = `Transformer_${ts}`;

    it("POST /terms", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/terms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          term: termName,
          definition: "A deep learning architecture.",
          category: "ALGORITHM",
        })
        .expect(201);

      expect(res.body.data.term).toBe(termName);
    });

    it("GET /terms?q=transform", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/terms?q=transform")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    it("GET /terms/:term", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/terms/${termName}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.term).toBe(termName);
    });
  });
});
