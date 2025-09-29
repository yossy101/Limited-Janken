import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type ClientFactory = () => SupabaseClient;

declare global {
  // eslint-disable-next-line no-var
  var __limitedJankenSupabaseClient: SupabaseClient | undefined;
}

function defaultFactory(): SupabaseClient {
  if (!globalThis.__limitedJankenSupabaseClient) {
    const url = process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    globalThis.__limitedJankenSupabaseClient = createClient(url, serviceKey, {
      auth: { persistSession: false }
    });
  }
  return globalThis.__limitedJankenSupabaseClient;
}

export interface HandlerContext<TPayload> {
  supabase: SupabaseClient;
  payload: TPayload;
}

export type EdgeExecutor<TPayload> = (context: HandlerContext<TPayload>) => Promise<unknown>;

export function createEdgeHandler<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  executor: EdgeExecutor<z.infer<TSchema>>,
  factory: ClientFactory = defaultFactory
) {
  return async function handler(request: Request) {
    const json = await request.json();
    const payload = schema.parse(json);
    const supabase = factory();
    try {
      const result = await executor({ supabase, payload });
      return new Response(JSON.stringify({ data: result }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    } catch (error) {
      console.error(`Edge handler error:`, error);
      return new Response((error as Error).message, { status: 400 });
    }
  };
}

export function createRpcExecutor<TSchema extends z.ZodTypeAny>(
  rpcName: string,
  transform?: (data: unknown) => unknown
): EdgeExecutor<z.infer<TSchema>> {
  return async ({ supabase, payload }) => {
    const { data, error } = await supabase.rpc(rpcName, payload as Record<string, unknown>);
    if (error) {
      throw new Error(error.message);
    }
    return transform ? transform(data) : data;
  };
}
