import "./appsignal.js";

import { accountFromAny } from "@cosmjs/stargate";
import { Protocol } from "./config.js";
import { querier } from "./query.js";
import { ORCHESTRATOR, client } from "./wallet.js";
import * as bow from "./workers/bow.js";
import * as bowmargin from "./workers/bowmargin.js";
import * as ghost from "./workers/ghost.js";
import { createGrant, getGrant } from "./workers/index.js";
import * as unstake from "./workers/unstake.js";
import * as usk from "./workers/usk.js";

const ENABLED = [
  // ...usk.contracts,
  // ...bow.contracts,
  ...bowmargin.contracts,
  // ...ghost.contracts,
  // ...unstake.contracts,
];

const run = async () => {
  await Promise.all(
    ENABLED.map(
      async (c: { address: string; protocol: Protocol }, idx: number) => {
        switch (c.protocol) {
          case Protocol.BOW:
            return bow.run(c.address, idx + 1);
          case Protocol.USK:
            return usk.run(c.address, idx + 1);
          case Protocol.GHOST:
            return ghost.run(c.address, idx + 1);
          case Protocol.BowMargin:
            return bowmargin.run(c.address, idx + 1);
          case Protocol.Unstake:
            return unstake.run(c.address, idx + 1);
        }
      }
    )
  );
};

(async function () {
  const orchestrator = await ORCHESTRATOR;

  try {
    const any = await querier.auth.account(orchestrator[1]);
    const account = any && accountFromAny(any);
    console.info(`[STARTUP] Orchestrator: ${account?.address}`);
  } catch (error: any) {
    console.error(`Account ${orchestrator[1]} does not exist. Send funds.`);
    process.exit();
  }

  console.log("x");

  const clients = await Promise.all(ENABLED.map((x, idx) => client(idx + 1)));

  const grants = await Promise.all(clients.map(getGrant));

  await grants.reduce(async (agg, grant, idx: number) => {
    if (grant) return agg;
    await agg;
    return createGrant(idx + 1);
  }, Promise.resolve());

  try {
    await run();
  } catch (error: any) {
    console.error(error);
  } finally {
    await run();
  }
})();
