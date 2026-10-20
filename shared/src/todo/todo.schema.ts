import { z } from 'zod';

/**
 * To-do API contract — single source of truth for the /api/trips/:tripId/todo
 * endpoints (trip task list with categories + assignees).
 *
 * Trip-scoped like packing: every endpoint verifies trip access (404 "Trip not
 * found") and mutations check the same 'packing_edit' permission the legacy route
 * uses (403 "No permission"). Rows are DB-shaped and kept open. Mutations
 * broadcast over WebSocket with the forwarded X-Socket-Id.
 */

export const todoCreateItemRequestSchema = z.object({
  name: z.string().min(1),
  // The client clears optional fields by sending explicit null (the service
  // coerces falsy to its defaults), so every optional metadata field is nullable.
  category: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  assigned_user_id: z.number().nullable().optional(),
  priority: z.number().optional(),
  // 伴手禮／代購欄位（kind='souvenir' 的品項才會用到，一般待辦留空）
  kind: z.enum(['souvenir']).nullable().optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  recipient: z.string().max(100).nullable().optional(),
  store: z.string().max(200).nullable().optional(),
  price_jpy: z.number().int().min(0).max(100_000_000).nullable().optional(),
});
export type TodoCreateItemRequest = z.infer<typeof todoCreateItemRequestSchema>;

export const todoUpdateItemRequestSchema = z.object({
  name: z.string().optional(),
  // The legacy route accepted both boolean and 0/1 for checked — both stay valid.
  checked: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  // Nullable fields follow the bodyKeys protocol: a key present with null
  // clears the field, an omitted key leaves it unchanged.
  category: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  assigned_user_id: z.number().nullable().optional(),
  priority: z.number().nullable().optional(),
  // 伴手禮／代購欄位（kind='souvenir' 的品項才會用到，一般待辦留空）
  quantity: z.number().int().min(1).max(999).optional(),
  recipient: z.string().max(100).nullable().optional(),
  store: z.string().max(200).nullable().optional(),
  price_jpy: z.number().int().min(0).max(100_000_000).nullable().optional(),
});
export type TodoUpdateItemRequest = z.infer<typeof todoUpdateItemRequestSchema>;

export const todoReorderRequestSchema = z.object({
  orderedIds: z.array(z.number()),
});
export type TodoReorderRequest = z.infer<typeof todoReorderRequestSchema>;

export const todoCategoryAssigneesRequestSchema = z.object({
  user_ids: z.array(z.number()),
});
export type TodoCategoryAssigneesRequest = z.infer<typeof todoCategoryAssigneesRequestSchema>;
