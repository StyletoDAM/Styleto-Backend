import { JwtSignOptions } from '@nestjs/jwt';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';

const rawExpiresIn = process.env.JWT_EXPIRES_IN;
const resolvedExpiresIn =
  rawExpiresIn && !Number.isNaN(Number(rawExpiresIn))
    ? Number(rawExpiresIn)
    : rawExpiresIn ?? '1h';

export const JWT_SIGN_OPTIONS: JwtSignOptions = {
  expiresIn: resolvedExpiresIn as JwtSignOptions['expiresIn'],
};
