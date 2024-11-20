// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************


const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.


// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************


// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
  helpers: {
    eq: function (a, b) {
      return a === b;
    }
  }
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);


// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });


// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************


// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.


// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
    cookie: { secure: false }
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.get('/', (req, res) => {
  res.render('pages/welcome');
});


app.get('/register', (req, res) => {
  res.render('pages/signup');
});

const user = {
    user_id: undefined,
    username: undefined,
    password: undefined,
    created_at: undefined,
    last_login: undefined,
};


app.get('/friends', async (req, res) => {
  try {
    // Fetch friends data from the database
    const friends = await db.any('SELECT * FROM buffspace_main.profile');
    
    // Render the page and pass the friends data to the Handlebars template
    res.render('pages/friends', { friends: friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/signup', (req, res) => {
  const signupSuccess = req.query.signupSuccess === 'true'; // Check if the signup was successful
  res.render('pages/signup', { signupSuccess });
});

app.post('/signup', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  console.log(req.body);

  db.tx(async t => {
    // Check if the username already exists
    const [row] = await t.any(
      `SELECT * FROM buffspace_main.user WHERE username = $1`, [username]
    );

    // Validate passwords and existing username
    if (row || (password !== confirmPassword)) {
      throw new Error(`Choose another username or ensure passwords match.`);
    }

    // Insert new user into the database
    await t.none(
      'INSERT INTO buffspace_main.user(username, password) VALUES ($1, $2);',
      [username, password]
    );
  })
    .then(() => {
      // Redirect to the signup page with a success query parameter
      res.redirect('/signup?signupSuccess=true');
    })
    .catch(err => {
      console.log(err);
      // Render the signup page with an error message
      res.render('pages/signup', {
        error: true,
        message: err.message, // Pass error message to the template
      });
    });
});



app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    res.render('pages/logout', { message: "Logged Out Successfully" });
  });
});


/*
//for testing
app.post('/signup', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  console.log(req.body);

  db.tx(async t => {
    // const hash = await bcrypt.hash(req.body.password, 10);

    const [row] = await t.any(
      `SELECT * FROM buffspace_main.user WHERE username = $1`, [username]
      );

    if (row || (password !== confirmPassword)) {
      throw new Error(`choose another username or password does not match`);
    }

    // There are either no prerequisites, or all have been taken.
    await t.none(
        'INSERT INTO buffspace_main.user(username, password, confirm_password) VALUES ($1, $2, $3);',
          [username, password, confirmPassword]
        );
      })
        .then(signup => {
          //console.info(courses);
          res.status(200).json({
            username: register.username,
            password: register.password,
            confirmPassword: register.confirmPassword,
            message: 'Registration successful.',
          });
        })
        .catch(err => {
          console.log(err);
          return res.status(400).json({
            username: register.username,
            password: register.password,
            confirmPassword: register.confirmPassword,
            message: 'Passwords do not match.',
          });
        });
});
*/

// -------------------------------------  ROUTES for login.hbs   ----------------------------------------------
app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Login submission
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  db.one('SELECT * FROM buffspace_main.user WHERE username = $1 LIMIT 1', [username])
    .then(user => {
      if (user.password === password) {
        req.session.user = {
          user_id: user.user_id,
          username: user.username,
          created_at: user.created_at,
          last_login: user.last_login,
        };
        req.session.save();
        res.redirect('/homepage');
      } else {
        res.render('pages/login', { error: true, message: 'Incorrect Password/Username.' });
      }
    })
    .catch(err => {
      console.error(err);
      res.render('pages/login', { error: true, message: 'Username not found.' });
    });
});


app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// Authentication middleware.
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

app.use(auth);


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more request

app.get('/profile/:username?', auth, (req, res) => {
  const requestedUsername = req.params.username || req.session.user.username;
  const query = `
    SELECT p.*, u.username, u.user_id
    FROM buffspace_main.profile p
    JOIN buffspace_main.user u ON p.user_id = u.user_id
    WHERE u.username = $1
  `;
  const values = [requestedUsername];

  db.one(query, values)
    .then(profileData => {
      res.render('pages/profile', {
        profile: profileData,
        isOwnProfile: profileData.user_id === req.session.user.user_id
      });
    })
    .catch(err => {
      console.log(err);
      res.render('pages/create-profile');
    });
});

app.get('/edit-profile', auth, (req, res) => {
  const userId = req.session.user.user_id;
  const query = `
    SELECT p.*, u.username
    FROM buffspace_main.profile p
    JOIN buffspace_main.user u ON p.user_id = u.user_id
    WHERE p.user_id = $1
  `;
  const values = [userId];

  db.one(query, values)
    .then(profileData => {
      res.render('pages/edit-profile', { profile: profileData });
    })
    .catch(err => {
      console.log(err);
      res.redirect('/profile');
    });
});

// POST route to handle profile updates
app.post('/edit-profile', auth, (req, res) => {
  const userId = req.session.user.user_id;
  const {
    first_name,
    last_name,
    bio,
    graduation_year,
    major,
    status,
    profile_picture_url
  } = req.body;

  const query = `
    UPDATE buffspace_main.profile
    SET
      first_name = $1,
      last_name = $2,
      bio = $3,
      graduation_year = $4,
      major = $5,
      status = $6,
      profile_picture_url = $7,
      last_updated = CURRENT_TIMESTAMP
    WHERE user_id = $8
    RETURNING *
  `;

  const values = [
    first_name,
    last_name,
    bio,
    graduation_year,
    major,
    status,
    profile_picture_url,
    userId
  ];

  db.one(query, values)
    .then(() => {
      res.redirect('/profile');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/edit-profile');
    });
});

const profile = {
  profile_id: undefined,
  user_id: undefined,
  bio: undefined,
  profile_picture_url: undefined,
  first_name: undefined,
  last_name: undefined,
  graduation_year: undefined,
  major: undefined,
  song_id: undefined,
  status: undefined,
  last_updated: undefined,
};

//SCAFFOLDING
app.get('/create-profile', auth, (req, res) => {
  // Check if user already has a profile
  const userId = req.session.user.user_id;
  const query = `
    SELECT * FROM buffspace_main.profile
    WHERE user_id = $1
  `;

  db.oneOrNone(query, [userId])
    .then(profile => {
      if (profile) {
        // If profile exists, redirect to profile page
        res.redirect('/profile');
      } else {
        // If no profile exists, render create profile page
        res.render('pages/create-profile', {
          user: req.session.user
        });
      }
    })
    .catch(err => {
      console.log(err);
      res.redirect('/');
    });
});

// Handle profile creation
app.post('/create-profile', auth, (req, res) => {
  const user_id = req.session.user.user_id;
  const {
    bio,
    profile_picture_url,
    first_name,
    last_name,
    graduation_year,
    major,
    status
  } = req.body;

  const query = `
    INSERT INTO buffspace_main.profile
    (user_id, bio, profile_picture_url, first_name, last_name, graduation_year, major, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;`;

  const values = [
    user_id,
    bio,
    profile_picture_url,
    first_name,
    last_name,
    graduation_year,
    major,
    status
  ];

  db.one(query, values)
    .then(profile => {
      res.redirect('/profile');
    })
    .catch(err => {
      res.render('pages/create-profile', {
        error: true,
        message: err.message,
    });
  });
});

//SCAFFOLDING END

app.get('/homepage', async (req, res) => {
  if (!req.session.user) {
    res.redirect('/login');

  }
  const user = req.session.user;

  const selectProfile = `
    SELECT * FROM buffspace_main.profile WHERE user_id = $1;
  `;

  const profile = await db.oneOrNone(selectProfile, [user.user_id]);

  if (!profile) {
    return res.redirect('/create-profile');
  }

  const selectFriends = `
    SELECT f.user_id_2, user_2_ranking, first_name, last_name, profile_picture_url
    FROM buffspace_main.friend f, buffspace_main.profile pr
    WHERE f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id
    ORDER BY user_2_ranking DESC LIMIT 8;
  `;

  const topFriends = await db.any(selectFriends);

  const selectPosts = `
    SELECT po.user_id, content, image_url,
           to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at, first_name, last_name, 
           profile_picture_url
    FROM buffspace_main.post po, buffspace_main.profile pr
    WHERE po.user_id = pr.user_id
    ORDER BY po.created_at DESC;
    `;

  const posts = await db.any(selectPosts);

  const selectMessages = `
    SELECT m.from_user_id, content, to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at, first_name, last_name, profile_picture_url
    FROM buffspace_main.message m, buffspace_main.profile pr
    WHERE m.to_user_id = ${user.user_id} AND m.from_user_id = pr.user_id
  `;

  const recentMessages = await db.any(selectMessages);

  res.render('pages/homepage', { profile, topFriends, posts, recentMessages });
});

app.post('/posts', auth, (req, res) => {
  const userId = req.session.user.user_id;
  const content = req.body.content;

  const query = `
    INSERT INTO buffspace_main.post (user_id, content)
    VALUES ($1, $2)
  `;

  const values = [userId, content];

  db.query(query, values)
      .then(result => {
        res.redirect('/homepage');
      })
      .catch(err => {
        console.log(err);
        res.redirect('/homepage');
      });
});

// Add these routes to your index.js

// Initial chat page load
app.get('/chat', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  try {
    // Get user's profile
    const profile = await db.one(
        'SELECT * FROM buffspace_main.profile WHERE user_id = $1',
        [userId]
    );

    // Get user's friends list with their latest message
    const friends = await db.any(`
            SELECT 
                p.*, 
                f.user_id_2,
                (
                    SELECT content 
                    FROM buffspace_main.message 
                    WHERE (from_user_id = f.user_id_1 AND to_user_id = f.user_id_2)
                       OR (from_user_id = f.user_id_2 AND to_user_id = f.user_id_1)
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) as last_message
            FROM buffspace_main.friend f
            JOIN buffspace_main.profile p ON p.user_id = f.user_id_2
            WHERE f.user_id_1 = $1
            ORDER BY (
                SELECT created_at 
                FROM buffspace_main.message 
                WHERE (from_user_id = f.user_id_1 AND to_user_id = f.user_id_2)
                   OR (from_user_id = f.user_id_2 AND to_user_id = f.user_id_1)
                ORDER BY created_at DESC 
                LIMIT 1
            ) DESC NULLS LAST
        `, [userId]);

    res.render('pages/chat', {
      profile,
      friends,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading chat page:', error);
    res.status(500).send('Error loading chat page');
  }
});

// Chat page with specific friend selected
app.get('/chat/:friendId', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  try {
    // Get user's profile
    const profile = await db.one(
        'SELECT * FROM buffspace_main.profile WHERE user_id = $1',
        [userId]
    );

    // Get user's friends list
    const friends = await db.any(`
            SELECT 
                p.*, 
                f.user_id_2,
                (
                    SELECT content 
                    FROM buffspace_main.message 
                    WHERE (from_user_id = f.user_id_1 AND to_user_id = f.user_id_2)
                       OR (from_user_id = f.user_id_2 AND to_user_id = f.user_id_1)
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) as last_message
            FROM buffspace_main.friend f
            JOIN buffspace_main.profile p ON p.user_id = f.user_id_2
            WHERE f.user_id_1 = $1
            ORDER BY (
                SELECT created_at 
                FROM buffspace_main.message 
                WHERE (from_user_id = f.user_id_1 AND to_user_id = f.user_id_2)
                   OR (from_user_id = f.user_id_2 AND to_user_id = f.user_id_1)
                ORDER BY created_at DESC 
                LIMIT 1
            ) DESC NULLS LAST
        `, [userId]);

    // Get selected friend's info and messages
    const selectedFriend = await db.one(`
            SELECT p.*, u.user_id
            FROM buffspace_main.profile p
            JOIN buffspace_main.user u ON p.user_id = u.user_id
            WHERE p.user_id = $1
        `, [req.params.friendId]);

    const messages = await db.any(`
            SELECT 
                m.*,
                EXTRACT(EPOCH FROM m.created_at) * 1000 as timestamp
            FROM buffspace_main.message m
            WHERE (from_user_id = $1 AND to_user_id = $2)
               OR (from_user_id = $2 AND to_user_id = $1)
            ORDER BY m.created_at ASC
        `, [userId, req.params.friendId]);

    res.render('pages/chat', {
      profile,
      friends,
      selectedFriend,
      messages,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading chat page:', error);
    res.status(500).send('Error loading chat page');
  }
});

// API endpoint for loading chat messages
app.get('/api/chat/:friendId', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  try {
    const selectedFriend = await db.one(`
            SELECT p.*, u.user_id
            FROM buffspace_main.profile p
            JOIN buffspace_main.user u ON p.user_id = u.user_id
            WHERE p.user_id = $1
        `, [req.params.friendId]);

    const messages = await db.any(`
            SELECT 
                m.*,
                EXTRACT(EPOCH FROM m.created_at) * 1000 as timestamp
            FROM buffspace_main.message m
            WHERE (from_user_id = $1 AND to_user_id = $2)
               OR (from_user_id = $2 AND to_user_id = $1)
            ORDER BY m.created_at ASC
        `, [userId, req.params.friendId]);

    res.json({
      selectedFriend,
      messages,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading chat:', error);
    res.status(500).json({ error: 'Error loading chat' });
  }
});

// API endpoint for sending messages
app.post('/api/messages', auth, async (req, res) => {
  const fromUserId = req.session.user.user_id;
  const { to_user_id, content } = req.body;

  try {
    await db.none(
        'INSERT INTO buffspace_main.message (from_user_id, to_user_id, content) VALUES ($1, $2, $3)',
        [fromUserId, to_user_id, content]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');