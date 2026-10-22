import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegistroDto } from './dto/registro.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/registro -> 201 Created si sale bien (es el default de @Post).
  @Post('registro')
  registro(@Body() registroDto: RegistroDto) {
    return this.authService.registro(registroDto);
  }
}
