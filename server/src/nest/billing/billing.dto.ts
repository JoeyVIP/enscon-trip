import { createZodDto } from 'nestjs-zod';
import {
  billingCheckoutRequestSchema,
  billingFreeOrganizerAddRequestSchema,
  billingPromoCreateRequestSchema,
  billingPromoUpdateRequestSchema,
} from '@trek/shared';

/** POST /api/billing/checkout 的 body：同意框要打勾（consent: true）並帶上看到的版本號。 */
export class BillingCheckoutDto extends createZodDto(billingCheckoutRequestSchema) {}

export class BillingPromoCreateDto extends createZodDto(billingPromoCreateRequestSchema) {}
export class BillingPromoUpdateDto extends createZodDto(billingPromoUpdateRequestSchema) {}
export class BillingFreeOrganizerAddDto extends createZodDto(billingFreeOrganizerAddRequestSchema) {}
