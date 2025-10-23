"use strict";

const { defineHook } = require("@directus/extensions-sdk");

module.exports = defineHook(({ action, logger }) => {
  logger.info("RLS HOOK: filesystem hook file was loaded"); // will appear in logs after “Extensions loaded”
  action("items.read", (meta) => {
    // your logic…
  });
});