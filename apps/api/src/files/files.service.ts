import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    const useSsl = this.config.get<string>("MINIO_USE_SSL", "false") === "true";
    const host = this.config.getOrThrow<string>("MINIO_ENDPOINT");
    const port = this.config.get<string>("MINIO_PORT", "9000");
    this.endpoint = `${useSsl ? "https" : "http"}://${host}:${port}`;
    this.bucket = this.config.getOrThrow<string>("MINIO_BUCKET");

    this.s3 = new S3Client({
      region: "us-east-1",
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>("MINIO_ACCESS_KEY"),
        secretAccessKey: this.config.getOrThrow<string>("MINIO_SECRET_KEY"),
      },
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (err && (err as { name: string }).name === "NotFound") {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      }
    }
  }

  async presignUpload(userId: string, filename: string, mimeType: string) {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `uploads/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}-${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: mimeType,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 15 * 60,
    });

    return {
      presignedUrl,
      objectKey,
      publicUrl: `${this.endpoint}/${this.bucket}/${objectKey}`,
    };
  }

  async presignDownload(objectKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 60 * 60,
    });
    return { presignedUrl };
  }

  getPublicUrl(objectKey: string) {
    return `${this.endpoint}/${this.bucket}/${objectKey}`;
  }

  getBucket() {
    return this.bucket;
  }
}
