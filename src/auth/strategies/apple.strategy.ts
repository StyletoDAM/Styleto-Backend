import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from '../auth.service';
import { AppleAuthDto } from '../dto/apple-auth.dto';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: any): Promise<any> {
    const dto: AppleAuthDto = req.body;
    if (!dto.identityToken) {
      throw new UnauthorizedException('Token Apple manquant');
    }
    return await this.authService.appleAuth(dto);
  }
}