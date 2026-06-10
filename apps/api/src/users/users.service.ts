import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AddInterestDto } from "./dto/add-interest.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("用户不存在");
    return this.toProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
      },
    });
    return this.toProfile(user);
  }

  async getInterests(userId: string) {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      interests: rows.map((r) => ({
        id: r.id,
        keyword: r.keyword,
        weight: r.weight,
        source: r.source,
      })),
    };
  }

  async addInterest(userId: string, dto: AddInterestDto) {
    const keyword = dto.keyword.trim();
    const existing = await this.prisma.userInterest.findUnique({
      where: { userId_keyword: { userId, keyword } },
    });
    if (existing) {
      throw new ConflictException("兴趣标签已存在");
    }
    const item = await this.prisma.userInterest.create({
      data: { userId, keyword },
    });
    return {
      id: item.id,
      keyword: item.keyword,
      weight: item.weight,
      source: item.source,
    };
  }

  async removeInterest(userId: string, id: string) {
    await this.prisma.userInterest.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      return this.prisma.userSettings.create({
        data: { userId },
      });
    }
    return {
      pushMorning: settings.pushMorning,
      pushEvening: settings.pushEvening,
      pushInstant: settings.pushInstant,
      languageUi: settings.languageUi,
      languageTranslate: settings.languageTranslate,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const updated = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return {
      pushMorning: updated.pushMorning,
      pushEvening: updated.pushEvening,
      pushInstant: updated.pushInstant,
      languageUi: updated.languageUi,
      languageTranslate: updated.languageTranslate,
    };
  }

  async getStats(userId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const stats = await this.prisma.readingStat.findMany({
      where: {
        userId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: "asc" },
    });
    return {
      stats: stats.map((s) => ({
        date: s.date.toISOString().split("T")[0],
        papersCount: s.papersCount,
        questionsCount: s.questionsCount,
        notesCount: s.notesCount,
        correctionsCount: s.correctionsCount,
        readingMinutes: s.readingMinutes,
        continuousDays: s.continuousDays,
      })),
    };
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
