import { toNextHandlers } from "zoutex/next";
import { getMeRoute } from "./route.def";

export const { GET } = toNextHandlers({ GET: getMeRoute });
