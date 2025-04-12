const config = require('../../config.js');
const SESSION_SECRET = process.env.SESSION_SECRET;
const STORAGE = process.env.STORAGE;

const fs = require('fs');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

function sessions() {
  const sessionStorage = path.join(STORAGE, 'sessions');
  fs.mkdirSync(sessionStorage, { recursive: true });
  const fileStoreOptions = {
    path: sessionStorage,
    ttl: 60 * 60 * 24
  };

  const sessionOptions = {
    store: new FileStore(fileStoreOptions),
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: 'auto', sameSite: 'Lax' }
  };
  return session(sessionOptions);
}

module.exports = sessions;
