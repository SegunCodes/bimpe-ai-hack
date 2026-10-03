import { Router } from "express";
import { agentContextRoutes } from "./modules/agentContext/agentContext.routes";
import { callsRoutes } from "./modules/calls/calls.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { signupRoutes } from "./modules/signup/signup.routes";

export const apiRoutes = Router();
apiRoutes.use("/customers", customersRoutes);
apiRoutes.use("/orders", ordersRoutes);
apiRoutes.use("/calls", callsRoutes);
apiRoutes.use("/public", signupRoutes);
apiRoutes.use("/agent-context", agentContextRoutes);
