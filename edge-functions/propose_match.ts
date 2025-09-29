import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  challenger_id: z.string().uuid(),
  opponent_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_propose_match"));

export default handler;
