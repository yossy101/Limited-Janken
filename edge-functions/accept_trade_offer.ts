import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  offer_id: z.string().uuid(),
  taker_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_accept_trade_offer", (data) => data ?? { success: true }));

export default handler;
