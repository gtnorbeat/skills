import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** MSW server instance — shared across integration test files. */
export const server = setupServer(...handlers);
