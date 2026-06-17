import { Controller, Post, Body, BadRequestException, Res, Req, Get, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }, @Res() res: Response) {
    const { email, password } = body;
    if (!email || !password) throw new BadRequestException('email and password required');
    const result = await this.authService.register(email, password);
    // Set refresh token in httpOnly cookie for browser clients
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: false, path: '/', maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.json({ accessToken: result.accessToken, user: result.user });
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res() res: Response) {
    const { email, password } = body;
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new BadRequestException('Invalid credentials');
    const accessToken = this.authService.signAccessToken(user.id, user.email);
    const refreshToken = await this.authService.createRefreshToken(user.id);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: false, path: '/', maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.json({ accessToken, user: { id: user.id, email: user.email } });
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string }, @Req() req: Request) {
    // Support cookie or body
    const token = body.refreshToken || (req.cookies && req.cookies.refreshToken);
    if (!token) throw new BadRequestException('refresh token required');
    const tokens = await this.authService.refresh(token);
    return tokens;
  }

  @Post('logout')
  async logout(@Body() body: { refreshToken?: string }, @Req() req: Request, @Res() res: Response) {
    const token = body.refreshToken || (req.cookies && req.cookies.refreshToken);
    if (token) await this.authService.revoke(token);
    res.clearCookie('refreshToken');
    return res.json({ ok: true });
  }

  @Get('me')
  async me(@Headers('authorization') auth: string) {
    if (!auth) return { authenticated: false };
    const token = auth.replace('Bearer ', '');
    const payload = this.authService.verifyAccessToken(token);
    const user = await (await import('@prisma/client')).PrismaClient.prototype.user?.apply?.call ? null : null;
    // Simple lookup
    const prisma = (await import('@prisma/client')).PrismaClient ? new (await import('@prisma/client')).PrismaClient() : null;
    if (!prisma) return { authenticated: false };
    const dbUser = await prisma.user.findUnique({ where: { id: payload.sub }, include: { accounts: true, profile: true } });
    if (!dbUser) return { authenticated: false };
    return { authenticated: true, user: { id: dbUser.id, email: dbUser.email, profile: dbUser.profile }, accounts: dbUser.accounts };
  }
}
