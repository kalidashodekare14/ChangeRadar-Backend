import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Length is not validated: a wrong short password must be INVALID_CREDENTIALS.
  @IsString()
  @MaxLength(200)
  password!: string;
}
