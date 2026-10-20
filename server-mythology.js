'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
// Lire les mêmes données et règles que le navigateur, sans second catalogue et sans moteur de combat serveur.
const context = vm.createContext({ window: {}, console, crypto });
for (const name of ['config', 'mythology-data', 'mythology-effects', 'mythology-match']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', name + '.js'), 'utf8'), context, { filename: name + '.js' });
}
module.exports.createAuthority = () => context.window.Eredita.MythologyMatch.createAuthority({
  random: () => crypto.randomInt(0x100000000) / 0x100000000,
  includeUnconfigured: process.env.EREDITA_MYTHOLOGY_DEVELOPMENT === '1'
});
