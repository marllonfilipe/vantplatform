import {dashboardRoutes} from './dashboard.mjs';
import {crmRoutes} from './crm.mjs';
export async function featureRoutes(ctx){return (await crmRoutes(ctx))??(await dashboardRoutes(ctx));}
