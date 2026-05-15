import { toNextHandlers } from "zoutex/next";
import { getUserRoute, updateUserRoute, deleteUserRoute } from "./route.def";

export const { GET, PUT, DELETE } = toNextHandlers({
  GET: getUserRoute,
  PUT: updateUserRoute,
  DELETE: deleteUserRoute,
});
