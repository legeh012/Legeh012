module.exports = {
  apps: [
    {
      name: 'storyforge-backend',
      script: 'server/index.js/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};