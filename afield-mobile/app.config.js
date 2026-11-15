const base = require("./app.json").expo;
// Only a limited development bridge token is exposed. The Google key stays in Node.
module.exports = () => ({
  ...base,
  extra: {
    ...base.extra,
    devRoutesToken:
      process.env.AFIELD_ENABLE_DEV_ROUTES === "1"
        ? require("./scripts/maps-bridge.cjs").session()
        : undefined,
  },
});
