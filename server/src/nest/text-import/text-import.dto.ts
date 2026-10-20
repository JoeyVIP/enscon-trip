import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MAX_TEXT_CHARS } from './rules';

/** 請求：文字上限 8,000 字元（超過 400）；useLlm=true 代表使用者按了「讓 AI 再解析一次」。 */
export const textImportRequestSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_CHARS),
  useLlm: z.boolean().optional(),
});

const stopSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  name: z.string().trim().min(1).max(80),
  note: z.string().max(300).optional(),
});

/** 回傳結構（LLM 回應也用這個驗證，不合格就丟棄）。 */
export const textImportResultSchema = z.object({
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dayIndex: z.number().int().min(0).max(400).optional(),
    stops: z.array(stopSchema).max(100),
  })).max(60),
  unassigned: z.array(stopSchema.extend({ label: z.string().max(40).optional() })).max(200),
  source: z.enum(['rules', 'llm']),
});

export class TextImportRequestDto extends createZodDto(textImportRequestSchema) {}

/**
 * 加入行程：前端預覽確認後送來的站點。一次請求、一個 DB transaction，全成功或全不建。
 * 長度上限對齊 places 的 STRING_LIMITS（name 200、notes 2000）。
 */
export const TEXT_IMPORT_APPLY_MAX_STOPS = 200;
export const textImportApplySchema = z.object({
  stops: z.array(z.object({
    dayId: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    note: z.string().max(2000).optional(),
  })).min(1).max(TEXT_IMPORT_APPLY_MAX_STOPS),
});

export class TextImportApplyDto extends createZodDto(textImportApplySchema) {}
