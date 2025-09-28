import { z } from "zod";

export async function callEdgeFunction<TInput extends z.ZodTypeAny, TResult>(
  path: string,
  schema: TInput,
  payload: z.infer<TInput>
): Promise<TResult> {
  const parsed = schema.parse(payload);
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parsed)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Edge function ${path} failed: ${message}`);
  }

  return (await response.json()) as TResult;
}
