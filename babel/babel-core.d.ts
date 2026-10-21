// @babel/core ships no types; the plugin's unit test only needs this.
declare module '@babel/core' {
  export function transformSync(
    code: string,
    options?: Record<string, unknown>
  ): { code?: string | null } | null;
}
