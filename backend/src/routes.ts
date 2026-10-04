import { Router } from "express";
import { authRoutes, requireAdmin } from "./modules/auth/auth";
import { agentContextRoutes } from "./modules/agentContext/agentContext.routes";
import { agentToolsRoutes, requireAgentToolSecret } from "./modules/agentTools/agentTools.routes";
import { bimpeSetupRoutes } from "./modules/bimpeSetup/bimpeSetup.routes";
import { callsRoutes } from "./modules/calls/calls.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { signupRoutes } from "./modules/signup/signup.routes";

export const apiRoutes = Router();
// Dashboard data needs the admin password (see modules/auth). Public, agent and cron
// routes below have their own protection or are meant to be public.
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/customers", requireAdmin, customersRoutes);
apiRoutes.use("/orders", requireAdmin, ordersRoutes);
apiRoutes.use("/calls", requireAdmin, callsRoutes);
apiRoutes.use("/public", signupRoutes);
// Returns customer details by phone, so it is only for the agent (same secret as the tools).
apiRoutes.use("/agent-context", requireAgentToolSecret, agentContextRoutes);
apiRoutes.use("/agent-tools", agentToolsRoutes);
apiRoutes.use("/admin", bimpeSetupRoutes);
