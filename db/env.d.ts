declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    QUADRUZZ_OWNER_USER_ID?: string;
  }
}
