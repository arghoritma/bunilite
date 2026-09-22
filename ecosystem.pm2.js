module.exports = {
  apps: [
    {
      name: "bunilite",
      script: "src/index.ts",
      interpreter: "bun",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_PATH: "data/bunilite.sqlite",
      },
    },
  ],
};
