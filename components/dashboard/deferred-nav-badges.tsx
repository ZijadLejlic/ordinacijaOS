import { countOpenCrmNotifications } from "@/lib/crm/load";
import { countLowStockItems } from "@/lib/inventory/load";

/** Open CRM count for nav badge (streams after shell). */
export async function CrmNavBadge({ clinicId }: { clinicId: string }) {
  const count = await countOpenCrmNotifications(clinicId);
  if (count <= 0) return null;
  return <NavBadgePill count={count} />;
}

/** Low-stock inventory count for nav badge (streams after shell). */
export async function InventoryNavBadge({ clinicId }: { clinicId: string }) {
  const count = await countLowStockItems(clinicId);
  if (count <= 0) return null;
  return <NavBadgePill count={count} />;
}

function NavBadgePill({ count }: { count: number }) {
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-xs font-semibold text-primary group-data-[active=true]/navitem:bg-white/20 group-data-[active=true]/navitem:text-inherit"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
