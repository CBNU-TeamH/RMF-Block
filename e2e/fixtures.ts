import { randomUUID } from "node:crypto";

import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

const prefix = `e2e-${process.env.E2E_RUN_ID ?? randomUUID().slice(0, 8)}`;
export const password = process.env.E2E_WORKSPACE_PASSWORD;

type User = { page: Page; context: BrowserContext; name: string };
export type Users = {
  name: (slot: number) => string;
  visitor: (slot: number) => Promise<User>;
  join: (slot: number) => Promise<User>;
  tab: (user: User) => Promise<Page>;
};

export const test = base.extend<{ users: Users }>({
  users: async ({ browser, baseURL }, provide) => {
    const contexts: BrowserContext[] = [];
    const name = (slot: number) => `${prefix}-${slot}`;
    const visitor = async (slot: number): Promise<User> => {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      return { context, page: await context.newPage(), name: name(slot) };
    };
    try {
      await provide({
        name,
        visitor,
        join: async (slot) => {
          if (!password) throw new Error("Set E2E_WORKSPACE_PASSWORD to the stack's password.");
          const user = await visitor(slot);
          const response = await user.context.request.post("/api/workspace/join", {
            data: { nickname: user.name, password, force: true },
          });
          expect(response.ok(), await response.text()).toBe(true);
          return user;
        },
        tab: (user) => user.context.newPage(),
      });
    } finally {
      const results = await Promise.allSettled(contexts.map((context) => context.close()));
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }
    }
  },
});

export { expect };
