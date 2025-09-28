import { z } from "zod";
import { createEdgeHandler, createRpcExecutor } from "./_shared";

const schema = z.object({
  room_id: z.string().uuid()
});

export const handler = createEdgeHandler(schema, createRpcExecutor("fn_evaluate_defeats", (data) => data ?? { success: true }));

export default handler;
