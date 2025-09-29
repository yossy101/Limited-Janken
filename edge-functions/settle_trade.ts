import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  offer_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_settle_trade", (data) => data ?? { success: true }));

export default handler;
