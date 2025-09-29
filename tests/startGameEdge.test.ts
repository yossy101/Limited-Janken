import handler from "../edge-functions/start_game";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("start_game edge function", () => {
  it("calls fn_start_game RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    (global as any).__limitedJankenSupabaseClient = { rpc } as unknown as SupabaseClient;

    const payload = {
      room_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      time_limit_seconds: 600,
      loan_amount: 3000
    };

    const response = await handler(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(payload)
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("fn_start_game", payload);
    const json = await response.json();
    expect(json).toHaveProperty("data");
  });
});
