const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: window.location.origin.includes('localhost') ? 'http://localhost:5001' : window.location.origin,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug'
    })
  );
};