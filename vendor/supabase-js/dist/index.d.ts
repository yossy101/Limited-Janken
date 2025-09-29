export interface SupabaseQueryBuilder<T> {
  select(columns?: string): Promise<{ data: T[] | null; error: Error | null }>;
  insert(values: Partial<T> | Partial<T>[]): Promise<{ data: T[] | null; error: Error | null }>;
  update(values: Partial<T>): Promise<{ data: T[] | null; error: Error | null }>;
  delete(): Promise<{ data: T[] | null; error: Error | null }>;
  eq(column: keyof T | string, value: unknown): SupabaseQueryBuilder<T>;
  single(): Promise<{ data: T | null; error: Error | null }>;
}

export interface SupabaseRealtimeChannel {
  on(event: string, filter: Record<string, unknown>, callback: (payload: unknown) => void): SupabaseRealtimeChannel;
  subscribe(callback?: (status: string) => void): Promise<unknown>;
  unsubscribe(): Promise<void>;
}

export interface SupabaseClientOptions {
  auth?: Record<string, unknown>;
}

export declare class SupabaseClient {
  constructor(url: string, key: string, options?: SupabaseClientOptions);
  from<T = any>(table: string): SupabaseQueryBuilder<T>;
  rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }>;
  channel(name: string): SupabaseRealtimeChannel;
}

export declare function createClient(url: string, key: string, options?: SupabaseClientOptions): SupabaseClient;
