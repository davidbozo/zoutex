import { registry } from "@/lib/registry";
import { ErrorSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export function GET() {
  const spec = registry.toOpenAPI({
    info: { title: "ZouteX Playground API", version: "1.0.0" },
    servers: [{ url: "http://localhost:4321", description: "Local server" }],
    defaultResponses: { 400: ErrorSchema, 500: ErrorSchema },
  });
  return new Response(JSON.stringify(spec, null, 2), {
    headers: { "content-type": "application/json" },
  });
}
