import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  room_id: z.string().uuid(),
  time_limit_seconds: z.number().min(30).max(3600),
  loan_amount: z.number().min(0).max(1000000)
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_start_game", (data) => data ?? { success: true }));

export default handler;
