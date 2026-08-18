module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: '7d',
  DEFAULT_ROOMS: ['general', 'random', 'tech-talk'],
};
