import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  match_id: z.string().uuid(),
  opponent_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_accept_match", (data) => data ?? { success: true }));

export default handler;
