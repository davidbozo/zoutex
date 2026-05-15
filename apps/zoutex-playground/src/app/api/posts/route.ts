import { toNextHandlers } from "zoutex/next";
import { listPostsRoute } from "./route.def";

export const { GET } = toNextHandlers({ GET: listPostsRoute });
