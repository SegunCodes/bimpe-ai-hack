import { Router } from "express";
import { agentContextRoutes } from "./modules/agentContext/agentContext.routes";
import { agentToolsRoutes, requireAgentToolSecret } from "./modules/agentTools/agentTools.routes";
import { bimpeSetupRoutes } from "./modules/bimpeSetup/bimpeSetup.routes";
import { callsRoutes } from "./modules/calls/calls.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { signupRoutes } from "./modules/signup/signup.routes";

export const apiRoutes = Router();
apiRoutes.use("/customers", customersRoutes);
apiRoutes.use("/orders", ordersRoutes);
apiRoutes.use("/calls", callsRoutes);
apiRoutes.use("/public", signupRoutes);
// Returns customer details by phone, so it is only for the agent (same secret as the tools).
apiRoutes.use("/agent-context", requireAgentToolSecret, agentContextRoutes);
apiRoutes.use("/agent-tools", agentToolsRoutes);
apiRoutes.use("/admin", bimpeSetupRoutes);
