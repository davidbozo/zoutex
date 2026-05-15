import { toNextHandlers } from "zoutex/next";
import { listUsersRoute, createUserRoute } from "./route.def";

export const { GET, POST } = toNextHandlers({
  GET: listUsersRoute,
  POST: createUserRoute,
});
