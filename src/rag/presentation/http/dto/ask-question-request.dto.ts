import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AskQuestionRequestDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
