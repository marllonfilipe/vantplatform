import {knowledgeRoutes} from './knowledge.mjs';
import {inboxRoutes} from './inbox.mjs';
import {dashboardRoutes} from './dashboard.mjs';
import {crmRoutes} from './crm.mjs';
export async function featureRoutes(ctx){return (await knowledgeRoutes(ctx))??(await inboxRoutes(ctx))??(await crmRoutes(ctx))??(await dashboardRoutes(ctx));}
