class SupabaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
  }

  select() {
    return Promise.resolve({ data: [], error: null });
  }

  insert() {
    return Promise.resolve({ data: null, error: null });
  }

  update() {
    return Promise.resolve({ data: null, error: null });
  }

  delete() {
    return Promise.resolve({ data: null, error: null });
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  single() {
    return Promise.resolve({ data: null, error: null });
  }
}

class SupabaseRealtimeChannel {
  constructor(name) {
    this.name = name;
  }

  on() {
    return this;
  }

  subscribe(callback) {
    if (callback) callback('SUBSCRIBED');
    return Promise.resolve({});
  }

  unsubscribe() {
    return Promise.resolve();
  }
}

class SupabaseClient {
  constructor(url, key, options = {}) {
    this.url = url;
    this.key = key;
    this.options = options;
  }

  from(table) {
    return new SupabaseQueryBuilder(table);
  }

  rpc() {
    return Promise.resolve({ data: null, error: null });
  }

  channel(name) {
    return new SupabaseRealtimeChannel(name);
  }
}

function createClient(url, key, options) {
  return new SupabaseClient(url, key, options);
}

export { createClient, SupabaseClient };
