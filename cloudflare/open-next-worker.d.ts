declare module "open-next-worker" {
  export interface OpenNextContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
  const worker: {
    fetch(
      request: Request,
      env: object,
      ctx: OpenNextContext,
    ): Promise<Response>;
  };
  export default worker;
}
