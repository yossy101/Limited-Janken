import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  match_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_resolve_match"));

export default handler;
