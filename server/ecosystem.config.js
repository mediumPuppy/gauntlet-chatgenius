module.exports = {
  apps: [{
    name: "chatgenius",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      WS_PORT: 3001,
      DB_USER: "chatgenius",
      DB_HOST: "chatgenius-db.c1q8aa4imx7s.us-east-2.rds.amazonaws.com",
      DB_NAME: "chatgenius",
      DB_PASSWORD: "SCJulY1rCjWhf6lNUwnV",
      DB_PORT: 5432,
      JWT_SECRET: "1e1075b8f895415a913d54326b89e1237d4276b856e75f4563ddf07d2b6b4048ab2bcca237e1eb415e50124e90a36c5a11d58f5a1aea8039c561db46a34e3a4f",
      CORS_ORIGIN: "http://localhost:5173"
    }
  }]
}
