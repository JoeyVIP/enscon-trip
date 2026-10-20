import { HttpException, Injectable } from '@nestjs/common';
import { DatabaseService, type TripAccess } from '../database/database.service';
import { PlacesService } from '../places/places.service';
import { AssignmentsService } from '../assignments/assignments.service';
import type { User } from '../../types';

export interface ApplyStop { dayId: number; name: string; time?: string; note?: string }

/**
 * 貼上文字排行程的「加入行程」：把預覽確認過的站點一次寫進行程。
 *
 * 照 roadtrip/google-route.service.ts 的 import()：先驗權限與每個 dayId，
 * 再在一個 db.transaction 裡逐站 places.create + assignments.createAssignment
 * （createAssignment 自己的 transaction 會變成 savepoint），任何一站失敗整批回滾、
 * 行程不留半套。commit 之後才廣播 place:created / assignment:created，
 * 並跑一次 journey reconcile，跟既有建立 place／assignment 的路徑送出一樣的即時同步事件。
 */
@Injectable()
export class TextImportApplyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly places: PlacesService,
    private readonly assignments: AssignmentsService,
  ) {}

  apply(trip: TripAccess, user: User, tripId: string, stops: ApplyStop[], socketId?: string) {
    // guard 已擋 day_edit；建 place 另外要 place_edit（同 POST /places 與 google-route import）
    if (!this.places.canEdit(trip, user)) throw new HttpException({ error: 'No permission' }, 403);
    for (const dayId of new Set(stops.map(s => s.dayId))) {
      if (!this.assignments.dayExists(dayId, tripId)) throw new HttpException({ error: 'Day not found' }, 404);
    }

    const created = this.insertAll(tripId, stops);
    for (const { place, assignment } of created) {
      this.places.broadcast(tripId, 'place:created', { place }, socketId);
      this.places.onCreated(tripId, place.id);
      this.assignments.broadcast(tripId, 'assignment:created', { assignment }, socketId);
    }
    this.assignments.reconcile(tripId, socketId);
    return { added: created.length };
  }

  /** 一個 transaction 建完所有站；任何一站丟錯就整批回滾，回 500（行程不變）。 */
  private insertAll(tripId: string, stops: ApplyStop[]) {
    try {
      return this.db.transaction(() => stops.map(s => {
        // 沒座標就不填（之後可用地圖搜尋補）；空時間／空備註存成 null（create 內 `|| null`）
        const place = this.places.create(tripId, { name: s.name.trim(), place_time: s.time, notes: s.note });
        const assignment = this.assignments.createAssignment(s.dayId, place.id);
        return { place, assignment };
      }));
    } catch (err) {
      // 轉成 HttpException 後全域 filter 不會再記錄 500，這裡留一行給維運：只記錯誤類型與訊息，不記站名／備註
      console.error('text-import apply rolled back:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error');
      throw new HttpException({ error: 'Import failed; nothing was added' }, 500);
    }
  }
}
