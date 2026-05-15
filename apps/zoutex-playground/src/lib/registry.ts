import { RouteRegistry } from "zoutex/openapi";
import { routeDefs as authMeRouteDefs } from "@/app/api/auth/me/route";
import { routeDefs as postsRouteDefs } from "@/app/api/posts/route";
import { routeDefs as userIdRouteDefs } from "@/app/api/users/[id]/route";
import { routeDefs as usersRouteDefs } from "@/app/api/users/route";

export const registry = new RouteRegistry();
registry.add(
  ...usersRouteDefs,
  ...userIdRouteDefs,
  ...postsRouteDefs,
  ...authMeRouteDefs,
);
