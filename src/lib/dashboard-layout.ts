export const dashboardSectionIds=["scheduling","invoices","calendar","students"] as const;
export type DashboardSectionId=typeof dashboardSectionIds[number];
export type DashboardLayoutSettings={order:DashboardSectionId[];minimized:DashboardSectionId[]};

export const defaultDashboardLayout:DashboardLayoutSettings={
  order:[...dashboardSectionIds],
  minimized:[],
};

export function normalizeDashboardLayout(value:unknown,available:DashboardSectionId[]):DashboardLayoutSettings{
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const requestedOrder=Array.isArray(input.order)?input.order.filter((id):id is DashboardSectionId=>typeof id==="string"&&dashboardSectionIds.includes(id as DashboardSectionId)):[];
  const order=[...new Set([...requestedOrder,...defaultDashboardLayout.order])].filter((id)=>available.includes(id));
  const minimized=Array.isArray(input.minimized)?input.minimized.filter((id):id is DashboardSectionId=>typeof id==="string"&&available.includes(id as DashboardSectionId)):[];
  return{order,minimized:[...new Set(minimized)]};
}
