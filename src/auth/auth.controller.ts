import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SafeUser, UserService, UpdateUserInput } from '../user/user.service';
import { AuthResponse, AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService, 
    private readonly jwtService: JwtService, 
  ) {}

  // --- Signup ---
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  // --- Signin ---
  @UseGuards(AuthGuard('local'))
  @Post('signin')
  @ApiOperation({ summary: 'Sign in using email and password' })
  @ApiBody({ type: SigninDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns JWT token.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async signin(@Request() req: { user: SafeUser }, @Body() _dto: SigninDto) {
    return this.authService.login(req.user);
  }

  // --- Get Profile ---
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Returns authenticated user profile.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid authentication token.' })
  getProfile(@Request() req: { user: SafeUser }) {
    return req.user;
  }

  // --- Update Profile ---
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid authentication token.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  async updateProfile(
    @Request() req: { user: SafeUser },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
  }

  // --- Delete Profile ---
  @UseGuards(JwtAuthGuard)
  @Delete('profile')
  @ApiOperation({ summary: 'Delete authenticated user account' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid authentication token.' })
  async deleteProfile(@Request() req: { user: SafeUser }) {
    await this.authService.deleteProfile(req.user.id);
    return { message: 'User deleted successfully' };
  }

  // --- Google Auth ---
  @Post('google')
  @ApiOperation({ summary: 'Authenticate or register via Google (iOS)' })
  @ApiBody({ type: GoogleAuthDto })
  @ApiResponse({ status: 200, description: 'Google authentication successful.' })
  @ApiResponse({ status: 401, description: 'Google authentication failed.' })
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto) {
    return this.authService.googleAuth(googleAuthDto);
  }

  @Get('google/callback')
  @ApiOperation({ 
  summary: 'Google OAuth callback endpoint',
  description: 'Callback endpoint for Google OAuth 2.0 authentication. Handles the redirect from Google after successful user authentication.'
  })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Request() req: { user: SafeUser }) {
    return this.authService.login(req.user);
  }

  // --- Apple Auth ---
  @Post('apple')
  @ApiOperation({ summary: 'Authenticate via Apple (iOS)' })
  @ApiBody({ type: AppleAuthDto })
  @ApiResponse({ status: 200, description: 'Apple authentication successful.' })
  async appleAuth(@Body() appleAuthDto: AppleAuthDto) {
    return this.authService.appleAuth(appleAuthDto);
  }



  // --- Verify Email ---
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    let payload: any;

    // 1. Vérifie le JWT temporaire
    try {
      payload = await this.jwtService.verifyAsync(body.tempToken);
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    // 2. Vérifie le code
    if (payload.code !== body.code) {
      throw new UnauthorizedException('Code incorrect');
    }

    // 3. Vérifie que le compte n'existe pas déjà
    const existingUser = await this.userService.findByEmail(payload.email);
    if (existingUser) {
      throw new ConflictException('Compte déjà créé');
    }

    // 4. CRÉE LE COMPTE UNIQUEMENT ICI
    const newUser = await this.userService.create({
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      gender: payload.gender,
      isVerified: true, // ← Vérifié !
    });

    return {
      message: 'Compte créé avec succès',
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        gender: newUser.gender,
      },
    };
  }






}
