const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
const { middleware } = require("./scripts/maps-bridge.cjs");
const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metro, server) => {
  const inner = previous ? previous(metro, server) : metro;
  const bridge = middleware(
    process.env.AFIELD_ENABLE_DEV_ROUTES === "1" ? undefined : "",
  );
  return (req, res, next) => bridge(req, res, () => inner(req, res, next));
};
// Private development credentials must never be served or watched by Metro.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /\.afield-.*\.local\.json$/,
];
module.exports = config;
