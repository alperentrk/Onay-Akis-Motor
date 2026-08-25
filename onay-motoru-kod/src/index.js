"use strict";

const veri = require("./veri");
const { onayZinciriOlustur } = require("./onayMotoru");
const eskalasyon = require("./eskalasyon");

module.exports = { veri, onayZinciriOlustur, ...eskalasyon };
