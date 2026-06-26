// swagger-ui-dist ships no TypeScript types; declare the ESM bundle entry we use.
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  const SwaggerUIBundle: (options: Record<string, unknown>) => unknown;
  export default SwaggerUIBundle;
}
