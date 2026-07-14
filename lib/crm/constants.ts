/** CRM light generation windows (Europe/Sarajevo). */
export const CRM_BIRTHDAY_WINDOW_DAYS = 7;
export const CRM_CONTROL_WINDOW_DAYS = 7;
export const CRM_RECALL_DAYS = 180;

export const CRM_KINDS = ["birthday", "recall", "control"] as const;
export type CrmKind = (typeof CRM_KINDS)[number];

export function isCrmKind(value: string): value is CrmKind {
  return (CRM_KINDS as readonly string[]).includes(value);
}
