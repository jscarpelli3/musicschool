export const dashboardSectionIds=["scheduling","invoices","quick_actions","calendar","students"] as const;
export type DashboardSectionId=typeof dashboardSectionIds[number];
export type DashboardLayoutSettings={order:DashboardSectionId[];minimized:DashboardSectionId[]};

export const defaultDashboardLayout:DashboardLayoutSettings={
  order:[...dashboardSectionIds],
  minimized:[],
};

export function normalizeDashboardLayout(value:unknown,available:DashboardSectionId[]):DashboardLayoutSettings{
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const requestedOrder=Array.isArray(input.order)?input.order.filter((id):id is DashboardSectionId=>typeof id==="string"&&dashboardSectionIds.includes(id as DashboardSectionId)):[];
  const migratedOrder=[...requestedOrder];
  if(!migratedOrder.includes("quick_actions")&&migratedOrder.includes("calendar"))migratedOrder.splice(migratedOrder.indexOf("calendar"),0,"quick_actions");
  const order=[...new Set([...migratedOrder,...defaultDashboardLayout.order])].filter((id)=>available.includes(id));
  const minimized=Array.isArray(input.minimized)?input.minimized.filter((id):id is DashboardSectionId=>typeof id==="string"&&available.includes(id as DashboardSectionId)):[];
  return{order,minimized:[...new Set(minimized)]};
}
