/** pm2 on VPS: `pm2 start /var/www/poker/ecosystem.config.cjs` */
module.exports = {
  apps: [
    {
      name: 'neonpoker-server',
      cwd: './apps/server',
      script: 'dist/main.js',
      env: {
        PORT: '3000',
        /** Must match how users open the site, e.g. http://89.125.64.106 */
        CORS_ORIGINS: 'http://89.125.64.106',
      },
    },
  ],
};
