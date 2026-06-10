import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { REDIS_CLIENT } from "../config/redis.provider";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("邮箱已被注册");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName ?? null,
      },
    });

    await this.prisma.userSettings.create({
      data: { userId: user.id },
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return {
      user: this.toProfile(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException("邮箱或密码错误");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("邮箱或密码错误");
    }
    const tokens = this.generateTokens(user.id, user.email, user.role);
    return {
      user: this.toProfile(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const blacklisted = await this.redis.get(
      `blacklist:refresh:${refreshToken}`,
    );
    if (blacklisted) {
      throw new UnauthorizedException("Refresh Token 已失效");
    }

    let payload: { sub: string; email: string; role: string; type?: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Refresh Token 无效");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Refresh Token 无效");
    }

    return this.generateTokens(payload.sub, payload.email, payload.role);
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
      const ttl = Math.max(1, Math.floor(payload.exp - Date.now() / 1000));
      await this.redis.set(`blacklist:refresh:${refreshToken}`, "1", "EX", ttl);
    } catch {
      // ignore invalid token
    }
    return { success: true };
  }

  private generateTokens(userId: string, email: string, role: string) {
    const access = this.jwt.sign(
      { sub: userId, email, role, type: "access" },
      {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
        expiresIn: this.config.get<string>("JWT_EXPIRES_IN", "2h"),
      },
    );
    const refresh = this.jwt.sign(
      { sub: userId, email, role, type: "refresh" },
      {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
      },
    );
    return { token: access, refreshToken: refresh };
  }

  private toProfile(user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    plan: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
