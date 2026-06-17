import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'CHANGE_ME';
  private refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'CHANGE_ME_TOO';

  async register(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        hashedPass: hashed,
        profile: { create: { kycStatus: 'pending' } }
      }
    });

    // Create a default checking account
    await prisma.account.create({ data: { userId: user.id, type: 'checking', currency: 'USD', balance: '0' } });

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
  }

  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.hashedPass);
    if (!ok) return null;
    return user;
  }

  signAccessToken(userId: number, email: string) {
    return jwt.sign({ sub: userId, email }, this.jwtSecret, { expiresIn: '15m' });
  }

  async createRefreshToken(userId: number) {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000); // 30 days
    await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
    return token;
  }

  async refresh(refreshToken: string) {
    const db = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!db || db.revoked) throw new UnauthorizedException('Invalid refresh token');
    if (db.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    const user = await prisma.user.findUnique({ where: { id: db.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const accessToken = this.signAccessToken(user.id, user.email);
    return { accessToken };
  }

  async revoke(refreshToken: string) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
  }

  verifyAccessToken(token: string) {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      return payload;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
