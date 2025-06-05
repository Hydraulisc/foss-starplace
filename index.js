const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { version } = require('./package.json');
const legalRoutes = require('./routes/legal');
const fs = require('fs');
const globals = JSON.parse(fs.readFileSync('global-variables.json', 'utf8'));
const cookieParser = require('cookie-parser');

const app = express();
const db = new sqlite3.Database('./database.db');

// Function to initialize the database and create tables if they don't exist
const initializeDatabase = () => {
    db.serialize(() => {
        // Create Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                hydraulisc_id TEXT,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                pfp TEXT NOT NULL,
                theme TEXT NOT NULL,
                biography TEXT NOT NULL,
                isAdmin BOOLEAN DEFAULT 0 NOT NULL,
                discriminator TEXT,
                language TEXT NOT NULL
            )
        `);

        // Create Invites table
        db.run(`
            CREATE TABLE IF NOT EXISTS invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                used INTEGER DEFAULT 0
            )
        `);

        // Create Boards table
        db.run(`
            CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT NOT NULL UNIQUE,
                owner INTEGER NOT NULL,
                description TEXT NOT NULL,
                indexable BOOLEAN DEFAULT 0 NOT NULL,
                language TEXT NOT NULL
            )
        `);

        // Create Posts table
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                board_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                filename TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE,
                FOREIGN KEY (board_id) REFERENCES boards(id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE
            )
        `);

        // Enable foreign key support
        db.run('PRAGMA foreign_keys = ON');
        console.log('Database initialized with required tables.');
    });
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Session configuration
app.use(session({
    secret: globals.sessionKey,
    resave: true,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
        secure: false,                  // Set to true if you use a valid SSL certificate for HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,    // 24 hours
        path: '/',
        sameSite: 'lax'                 // Added for security
    },
    rolling: true                       // Refresh session with each request
}));
app.use(cookieParser());

// Dynamic Routes
const middlewarePath = path.join(__dirname, 'routes');
fs.readdirSync(middlewarePath).forEach(file => {
    if (file.endsWith('.js')) {
        const route = '/' + path.basename(file, '.js'); // filename without .js
        const middleware = require(path.join(middlewarePath, file));
  
        app.use(route, middleware);
        console.log(`Mounted middleware at ${route} from ${file}`);
    }
});

// Static files and views
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Landing
app.get('/', async (req, res) => {
    try {
        res.render('pages/index', {
            username: req.session.user?.username || null,
            uid: req.session.user?.id || null,
            title: globals.title,
            logoURL: globals.logoURL,
            bannerURL: globals.bannerURL,
            shortDescription: globals.shortDescription,
            kofiURL: globals.kofiURL,
            posts: []
        })
    } catch(err) {
        res.render('pages/404')
    }
})

// Onboarding
app.get('/welcome', (req, res) => {
    res.render('pages/welcome', {
        version,
        username: null,
        uid: null,
        title: globals.title,
        logoURL: globals.logoURL,
        kofiURL: globals.kofiURL
    })
})

// Login
app.get('/login', (req, res) => {
    res.render('pages/login', {
        username: null,
        uid: null,
        title: globals.title,
        logoURL: globals.logoURL,
        bannerURL: globals.bannerURL,
        hydrauliscAuth: globals.hydrauliscAuth,
        hydrauliscAuthToken: globals.hydrauliscAuthToken
    })
})

// Register
app.get('/register', (req, res) => {
    res.render('pages/register', {
        username: null,
        uid: null,
        title: globals.title,
        logoURL: globals.logoURL,
        bannerURL: globals.bannerURL
    })
})

// Userpage
app.get('/user/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId;
    db.get(
      `SELECT hydraulisc_id, username, pfp, discriminator, biography FROM users WHERE id = ?`,
      [userId],
      async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Local user
        if (!user.hydraulisc_id) {
          return res.render('pages/userpage', {
            userpage: user.username,
            username: req.session.user?.username || null,
            logoURL: globals.logoURL,
            title: globals.title,
            kofiURL: globals.kofiURL,
            pfp: user.pfp,
            uid: req.session.user?.id || null,
            foreignUser: false
          });
        }

        // Foreign user (OAuth2-based)
        try {
          const foreignRes = await fetch(`https://hydraulisc.net/api/${user.hydraulisc_id}`);
          if (!foreignRes.ok) throw new Error('Failed to fetch foreign user data');
          const data = await foreignRes.json();

          return res.render('pages/userpage', {
            userpage: `${data.user.username}#${data.user.discriminator}`,
            username: req.session.user?.username || null,
            logoURL: globals.logoURL,
            title: globals.title,
            kofiURL: globals.kofiURL,
            pfp: `https://hydraulisc.net${data.user.pfp}`,
            uid: req.session.user?.id || null,
            foreignUser: true
          });
        } catch (fetchErr) {
          console.error('User info fetch failed:', fetchErr.message);
          return res.status(500).send('Failed to fetch foreign user info.');
        }
      }
    );
  } catch (outerErr) {
    console.error('Unexpected error:', outerErr.message);
    return res.status(500).send('Unexpected server error.');
  }
});

// Display /boards
app.get('/boards', async (req, res) => {
    res.render('pages/starboards', {
        username: req.session.user?.username || null,
        logoURL: globals.logoURL,
        title: globals.title,
        kofiURL: globals.kofiURL,
        uid: req.session.user?.id || null,
        boards: []
    })
})

app.get('/create', (req,res) => {
    if(!req.session.user?.username) {
        res.redirect('/login');
    } else {
        res.render('pages/create', {
            logoURL: globals.logoURL,
            title: globals.title,
            kofiURL: globals.kofiURL,
            uid: req.session.user?.id || null,
            username: req.session.user?.username || null
        }); 
    }
})

// Start server
const PORT = globals.hostPort || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeDatabase(); // Initialize the database when the server starts
});