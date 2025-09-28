import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  maker_id: z.string().uuid(),
  taker_id: z.string().uuid().optional(),
  give_json: z.record(z.string(), z.any()),
  take_json: z.record(z.string(), z.any()),
  room_id: z.string().uuid().optional()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_create_trade_offer"));

export default handler;
