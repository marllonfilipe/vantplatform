import {minutesRoutes} from './minutes.mjs';
import {meetingRoutes} from './meetings.mjs';
import {copilotRoutes} from './copilot.mjs';
import {agentRoutes} from './agents.mjs';
import {analysisRoutes} from './analysis.mjs';
import {knowledgeRoutes} from './knowledge.mjs';
import {inboxRoutes} from './inbox.mjs';
import {dashboardRoutes} from './dashboard.mjs';
import {crmRoutes} from './crm.mjs';
export async function featureRoutes(ctx){return (await minutesRoutes(ctx))??(await meetingRoutes(ctx))??(await copilotRoutes(ctx))??(await agentRoutes(ctx))??(await analysisRoutes(ctx))??(await knowledgeRoutes(ctx))??(await inboxRoutes(ctx))??(await crmRoutes(ctx))??(await dashboardRoutes(ctx));}
