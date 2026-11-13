import { IsOptional, Matches } from "class-validator";

// ?desde=2026-11-01&hasta=2026-11-30 (los dos opcionales).
// Sin fechas: los últimos 30 días. El formato es el del <input type="date"> del front.
export class RangoFechasDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha "desde" debe tener el formato AAAA-MM-DD',
  })
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD',
  })
  hasta?: string;
}
