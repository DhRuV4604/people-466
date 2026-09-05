import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';
import { PaginationQueryDto } from '../../../common/pagination';

/** Multipart sends everything as text, so booleans arrive as "true". */
const asBoolean = () =>
  Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value));

export class CreateDocumentDto {
  @ApiProperty({ example: 'Joining letter' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: DOCUMENT_KINDS })
  @IsIn(DOCUMENT_KINDS)
  kind!: (typeof DOCUMENT_KINDS)[number];

  @ApiProperty({ description: 'Whose file this belongs in' })
  @IsEntityId()
  employeeId!: string;

  @ApiPropertyOptional({ description: 'Shown to the employee above the document' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @asBoolean()
  @IsBoolean()
  requiresSignature?: boolean;

  /**
   * Send it straight away rather than leaving it as a draft. A draft is only
   * visible to the people who can manage documents.
   */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @asBoolean()
  @IsBoolean()
  send?: boolean;
}

/** Asking an employee for a file. No upload: there is nothing to attach yet. */
export class RequestDocumentDto {
  @ApiProperty({ example: 'Passport scan' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: DOCUMENT_KINDS })
  @IsIn(DOCUMENT_KINDS)
  kind!: (typeof DOCUMENT_KINDS)[number];

  @ApiProperty()
  @IsEntityId()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class SignDocumentDto {
  @ApiProperty({ description: 'The drawn or typed mark, as a PNG data URL' })
  @IsString()
  @MaxLength(2_000_000)
  signatureImage!: string;

  @ApiProperty({ description: 'Typed to confirm intent, checked against the signer' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  typedName!: string;
}

export class DeclineDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class QueryDocumentsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: (typeof DOCUMENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: DOCUMENT_KINDS })
  @IsOptional()
  @IsIn(DOCUMENT_KINDS)
  kind?: (typeof DOCUMENT_KINDS)[number];
}

/** Ask the model to write a document from what the system already knows. */
export class DraftDocumentDto {
  @ApiProperty({ enum: DOCUMENT_KINDS })
  @IsIn(DOCUMENT_KINDS)
  kind!: (typeof DOCUMENT_KINDS)[number];

  @ApiProperty()
  @IsEntityId()
  employeeId!: string;

  @ApiPropertyOptional({ description: 'Anything HR wants said, in their words' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresSignature?: boolean;
}
