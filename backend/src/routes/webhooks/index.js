const router = require('express').Router();
const { handleChangelog } = require('./changelog');
const { handleDispatcharr } = require('./dispatcharr');
const { handleGithub } = require('./github');

router.post('/changelog', handleChangelog);
router.post('/dispatcharr', handleDispatcharr);
router.post('/github/:token', handleGithub);

module.exports = router;
