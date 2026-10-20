import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RuntimeEnvService } from '../app-config/runtime-env.service';
import { parseWithLlm } from './llm';
import { parseItineraryText, type DayContext, type ParseResult } from './rules';

export class LlmDisabledError extends Error {}

/** 貼上文字排行程：先規則、不夠再 LLM。文字只在記憶體處理，不寫 DB、不進日誌。 */
@Injectable()
export class TextImportService {
  constructor(private readonly db: DatabaseService, private readonly env: RuntimeEnvService) {}

  /** 行程每天的日期（依 day_number），未排日期的天為 null。 */
  dayContext(tripId: number): DayContext {
    const rows = this.db.all<{ date: string | null }>('SELECT date FROM days WHERE trip_id = ? ORDER BY day_number ASC, id ASC', tripId);
    return { dayDates: rows.map(r => r.date ?? null) };
  }

  llmEnabled(): boolean {
    return !!this.env.env().integrations.textImportOpenaiKey;
  }

  async parse(tripId: number, text: string, useLlm: boolean): Promise<ParseResult> {
    const key = this.env.env().integrations.textImportOpenaiKey;
    if (useLlm && !key) throw new LlmDisabledError();
    const ctx = this.dayContext(tripId);
    const { result, ok } = parseItineraryText(text, ctx);
    if (ok && !useLlm) return result;
    if (!key) return result; // 規則不夠但 LLM 關閉：直接給規則結果（可能全在未歸類）
    const llm = await parseWithLlm(text, ctx, key);
    return llm ?? result;
  }
}
