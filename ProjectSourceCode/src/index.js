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

const register = {
  username: undefined,
  password: undefined,
};

app.get('/signup', (req, res) => {
  res.render('pages/signup');
});

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
      throw new Error(`choose another username`);
    }
    else if (password !== confirmPassword) {
      throw new Error(`password does not match`);
    }

    // There are either no prerequisites, or all have been taken.
    await t.none(
      'INSERT INTO buffspace_main.user(username, password) VALUES ($1, $2);',
      [username, password]
    );
  })
    .then(signup => {
      //console.info(courses);
      res.render('pages/login', {
        username: register.username,
        password: register.password,
        message: `Success`,
      });
    })
    .catch(err => {
      res.render('pages/signup', {
        error: true,
        message: err.message,
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

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
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
    INSERT INTO buffspace_main.profile
    (user_id, first_name, last_name, bio, graduation_year, major, status, profile_picture_url, last_updated)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const values = [
    userId,
    first_name,
    last_name,
    bio,
    graduation_year,
    major,
    status,
    profile_picture_url
  ];

  db.one(query, values)
    .then(() => {
      res.redirect('/profile');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/create-profile');
    });
});
//SCAFFOLDING END


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

app.get('/homepage', (req, res) => {
  const user = {
    name: 'John Doe'
  };

  const posts = [
    {
      user: {
        name: 'Alice Smith',
        avatar_url: 'https://img.freepik.com/premium-vector/avatar-minimalist-line-art-icon-logo-symbol-black-color-only_925376-257641.jpg'
      },
      created_at: '12:28 AM Nov 8',
      image_url: 'https://i.redd.it/6uk0m6nclyd21.jpg',
      content: 'oh lawd he comin'
    },
    {
      user: {
        name: 'Bob Johnson',
        avatar_url: 'https://img.freepik.com/premium-vector/boy-minimalist-line-art-icon-logo-symbol-black-color-only_925376-259120.jpg'
      },
      created_at: '12:15 PM Nov 7',
      image_url: 'https://pbs.twimg.com/media/FxBERTuWYAEPqSU.jpg:large',
      content: 'he do a thonk'
    }
  ];

  const topFriends = [
    { name: 'Alice', avatar_url: 'https://img.freepik.com/premium-vector/avatar-minimalist-line-art-icon-logo-symbol-black-color-only_925376-257641.jpg' },
    { name: 'Bob', avatar_url: 'https://img.freepik.com/premium-vector/boy-minimalist-line-art-icon-logo-symbol-black-color-only_925376-259120.jpg' },
    { name: 'Charlie', avatar_url: 'https://content.wepik.com/statics/20269019/preview-page3.jpg' },
    { name: 'David', avatar_url: 'https://content.wepik.com/statics/20269016/preview-page1.jpg' },
    { name: 'Emma', avatar_url: 'https://content.wepik.com/statics/21209542/preview-page5.jpg' },
    { name: 'Fiona', avatar_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTo9tUMVlpZVjqC2ympZR0fOHZJDfmqQev8JTqDcoO6hSqk9kpCczZTDgPH_PYakXPFf6o&usqp=CAU' },
    { name: 'George', avatar_url: 'https://content.wepik.com/statics/21209543/preview-page6.jpg' },
    { name: 'Hannah', avatar_url: 'https://content.wepik.com/statics/21209540/preview-page3.jpg' }
  ];

  const recentMessages = [
    {
      user: {
        avatar_url: 'https://content.wepik.com/statics/20269019/preview-page3.jpg',
        name: 'Charlie Dylanson'
      },
      timestamp: '10:30 AM',
      content: 'Sleep? BuffSpace never sleeps!'
    },
    {
      user: {
        avatar_url: 'https://content.wepik.com/statics/21209543/preview-page6.jpg',
        name: 'George Georgish'
      },
      timestamp: '10:32 AM',
      content: 'I need more caffeine.'
    },
    {
      user: {
        avatar_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmIo42UGDaWsRLggK0jDKeUhcwRe39QyC8hg&s',
        name: 'Chip'
      },
      timestamp: '10:35 AM',
      content: 'Hey, what have you been up to?'
    }
  ];

  const selectFriends = `
  SELECT f.user_id_2, user_2_ranking, first_name, last_name, profile_picture_url
  FROM buffspace_main.friend f, buffspace_main.profile pr
  WHERE f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id
  `

  const selectPosts = `
    SELECT po.user_id, content, image_url, created_at, first_name, last_name, 
           profile_picture_url
    FROM buffspace_main.post po, buffspace_main.profile pr
    WHERE po.user_id = pr.user_id;
    `

  res.render('pages/homepage', { user, posts, topFriends, recentMessages });
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');