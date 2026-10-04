import { Router } from "express";
import { adminAuthRoutes, authRoutes, requireAdmin, requireBusiness } from "./modules/auth/auth";
import { adminRoutes } from "./modules/admin/admin.routes";
import { agentContextRoutes } from "./modules/agentContext/agentContext.routes";
import { agentToolsRoutes, requireAgentToolSecret } from "./modules/agentTools/agentTools.routes";
import { billingRoutes } from "./modules/billing/billing";
import { bimpeSetupRoutes } from "./modules/bimpeSetup/bimpeSetup.routes";
import { callsRoutes } from "./modules/calls/calls.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { signupRoutes } from "./modules/signup/signup.routes";

export const apiRoutes = Router();

// Business accounts: sign up, sign in, and who am I.
apiRoutes.use("/auth", authRoutes);
// A business's own data. Every query inside is scoped to the signed-in business.
apiRoutes.use("/customers", requireBusiness, customersRoutes);
apiRoutes.use("/orders", requireBusiness, ordersRoutes);
apiRoutes.use("/calls", requireBusiness, callsRoutes);
apiRoutes.use("/billing", billingRoutes);

// The website's "Call me" form and /join (Tellero AI's own account).
apiRoutes.use("/public", signupRoutes);

// Used by BimpeAI's agent during calls (its own secret).
apiRoutes.use("/agent-context", requireAgentToolSecret, agentContextRoutes);
apiRoutes.use("/agent-tools", agentToolsRoutes);

// Platform owner. /admin/bimpe-setup keeps its CRON_SECRET check; everything else needs the admin session.
apiRoutes.use("/admin-auth", adminAuthRoutes);
apiRoutes.use("/admin", bimpeSetupRoutes);
apiRoutes.use("/admin", requireAdmin, adminRoutes);
