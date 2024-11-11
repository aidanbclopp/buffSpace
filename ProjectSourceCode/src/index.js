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
    res.render('pages/home');
});

app.get('/register', (req, res) => {
    res.render('pages/signup');
});

// -------------------------------------  ROUTES for login.hbs   ----------------------------------------------
const user = {
  user_id: undefined,
  username: undefined,
  password: undefined,
  created_at: undefined,
  last_login: undefined,
};

app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Login submission
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const query = 'select * from buffspace_main.user where password = $1 LIMIT 1';
  const values = [password];

  // get the user_id based on the password
  db.one(query, values)
    .then(data => {
      user.user_id = data.user_id;
      user.username = username;
      user.password = data.password;
      user.created_at = data.created_at;
      user.last_login = data.last_login;

      req.session.user = user;
      req.session.save();
    
      res.redirect('/profile');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});

// Authentication middleware.
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

app.use(auth);


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
      res.redirect('/');
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


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');