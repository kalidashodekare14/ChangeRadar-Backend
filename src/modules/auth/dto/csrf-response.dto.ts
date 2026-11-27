import { IsString } from 'class-validator';

export class CsrfResponseDto {
  @IsString()
  csrfToken!: string;
}
