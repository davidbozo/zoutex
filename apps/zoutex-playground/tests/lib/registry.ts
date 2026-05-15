import { RouteRegistry } from "zoutex/openapi";
import { listUsersRoute, createUserRoute } from "@/app/api/users/route.def";
import { getUserRoute, updateUserRoute, deleteUserRoute } from "@/app/api/users/[id]/route.def";
import { listPostsRoute } from "@/app/api/posts/route.def";
import { getMeRoute } from "@/app/api/auth/me/route.def";

export const registry = new RouteRegistry();
registry.add(
  listUsersRoute,
  createUserRoute,
  getUserRoute,
  updateUserRoute,
  deleteUserRoute,
  listPostsRoute,
  getMeRoute,
);
