const express = require('express');
const { DEFAULT_ROOMS } = require('../config');

module.exports = function roomRoutes() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({ rooms: DEFAULT_ROOMS });
  });

  return router;
};
