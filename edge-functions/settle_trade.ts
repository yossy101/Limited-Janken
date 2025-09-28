import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  offer_id: z.string().uuid()
});

type AssetShape = {
  stars?: number;
  rock?: number;
  paper?: number;
  scissors?: number;
  cash?: number;
};

const allowedKeys = ["stars", "rock", "paper", "scissors", "cash"] as const;

const normalizeAssets = (value: unknown): AssetShape => {
  if (!value || typeof value !== "object") return {};
  const result: AssetShape = {};
  for (const key of allowedKeys) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    result[key] = num;
  }
  return result;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { offer_id } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const offer = await selectOne<{
        id: string;
        room_id: string;
        status: string;
        maker_id: string;
        taker_id: string | null;
        give_json: unknown;
        take_json: unknown;
        maker_name: string | null;
        taker_name: string | null;
      }>(
        client,
        `select t.id, t.room_id, t.status, t.maker_id, t.taker_id, t.give_json, t.take_json,
                maker.name as maker_name, taker.name as taker_name
         from trade_offers t
         join players maker on maker.id = t.maker_id
         left join players taker on taker.id = t.taker_id
         where t.id = $1
         for update`,
        [offer_id]
      );

      if (!offer) {
        throw new Error("Offer not found");
      }
      if (!offer.taker_id) {
        throw new Error("取引相手が未設定です");
      }
      if (offer.status !== "accepted") {
        throw new Error("オファーが受諾状態ではありません");
      }

      const give = normalizeAssets(offer.give_json);
      const take = normalizeAssets(offer.take_json);

      const makerAssets = await selectOne<Required<AssetShape>>(
        client,
        "select stars, rock, paper, scissors, cash from player_assets where player_id = $1 for update",
        [offer.maker_id]
      );
      const takerAssets = await selectOne<Required<AssetShape>>(
        client,
        "select stars, rock, paper, scissors, cash from player_assets where player_id = $1 for update",
        [offer.taker_id]
      );

      if (!makerAssets || !takerAssets) {
        throw new Error("資産取得に失敗しました");
      }

      const nextMaker: AssetShape = { ...makerAssets };
      const nextTaker: AssetShape = { ...takerAssets };

      for (const key of allowedKeys) {
        const giveValue = give[key] ?? 0;
        const takeValue = take[key] ?? 0;
        const makerNext = (nextMaker[key] ?? 0) - giveValue + takeValue;
        const takerNext = (nextTaker[key] ?? 0) + giveValue - takeValue;
        if (makerNext < 0 || takerNext < 0) {
          throw new Error("資産がマイナスになります");
        }
        nextMaker[key] = makerNext;
        nextTaker[key] = takerNext;
      }

      await client.queryObject({
        text: "update player_assets set stars = $1, rock = $2, paper = $3, scissors = $4, cash = $5, updated_at = $6 where player_id = $7",
        args: [nextMaker.stars ?? 0, nextMaker.rock ?? 0, nextMaker.paper ?? 0, nextMaker.scissors ?? 0, nextMaker.cash ?? 0, nowIso(), offer.maker_id]
      });
      await client.queryObject({
        text: "update player_assets set stars = $1, rock = $2, paper = $3, scissors = $4, cash = $5, updated_at = $6 where player_id = $7",
        args: [nextTaker.stars ?? 0, nextTaker.rock ?? 0, nextTaker.paper ?? 0, nextTaker.scissors ?? 0, nextTaker.cash ?? 0, nowIso(), offer.taker_id]
      });

      await client.queryObject({
        text: "update trade_offers set status = 'settled', updated_at = $1 where id = $2",
        args: [nowIso(), offer_id]
      });

      const starTransfers: { from_player: string; to_player: string; amount: number }[] = [];
      const starDelta = (give.stars ?? 0) - (take.stars ?? 0);
      if (starDelta > 0) {
        starTransfers.push({ from_player: offer.maker_id, to_player: offer.taker_id, amount: starDelta });
      } else if (starDelta < 0) {
        starTransfers.push({ from_player: offer.taker_id, to_player: offer.maker_id, amount: Math.abs(starDelta) });
      }

      for (const transfer of starTransfers) {
        await client.queryObject({
          text: "insert into star_transfers (room_id, from_player, to_player, amount, created_at) values ($1, $2, $3, $4, $5)",
          args: [offer.room_id, transfer.from_player, transfer.to_player, transfer.amount, nowIso()]
        });
      }

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [
          offer.room_id,
          `${offer.maker_name ?? "プレイヤー"} と ${offer.taker_name ?? "相手"} の取引が成しました。`,
          nowIso()
        ]
      });
    });

    return new Response(JSON.stringify({ status: "settled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    let status = 500;
    if (message === "Offer not found") status = 404;
    else if (message === "取引相手が未設定です" || message === "オファーが受諾状態ではありません" || message === "資産がマイナスになります") {
      status = 400;
    }
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
