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

// *****************************************************
// <!-- Section 4 : App Settings -->
// *****************************************************
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
      throw new Error(`choose another username or password does not match`);
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
              username: user.username,
              password: user.password,
              message: `Success`,
          });
          res.session.user = user;
          res.session.save();
        })
        .catch(err => {
          console.log(err);
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
app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Login submission
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const query = 'select * from buffspace_main.user where username = $1 and password = $2 LIMIT 1';
  const values = [username, password];

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

      res.redirect('/homepage');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
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


const fetchMajors = async () => {
  const query = 'SELECT * FROM buffspace_main.majors;';
  return await db.any(query);
};

app.get('/profile/:username?', auth, async (req, res) => {
  const requestedUsername = req.params.username || req.session.user.username;
  const query = `
    SELECT 
        p.*,
        u.username,
        m.major_name,
        m.major_id
    FROM buffspace_main.profile p
    JOIN buffspace_main.user u ON p.user_id = u.user_id
    LEFT JOIN buffspace_main.student_majors sm ON sm.user_id = u.user_id
    LEFT JOIN buffspace_main.majors m ON sm.major_id = m.major_id
    WHERE u.username = $1
  `;
  const values = [requestedUsername];

  try {
    const profileData = await db.one(query, values);
    res.render('pages/profile', {
      profile: profileData,
      isOwnProfile: profileData.user_id === req.session.user.user_id
    });
  } catch (err) {
    console.log(err);
    res.redirect('/create-profile');
  }
});

app.get('/edit-profile', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const query = `
    SELECT 
      p.*,
      u.username,
      sm.major_id
    FROM buffspace_main.profile p
    JOIN buffspace_main.user u ON p.user_id = u.user_id
    LEFT JOIN buffspace_main.student_majors sm ON sm.user_id = p.user_id
    WHERE p.user_id = $1
  `;
  const values = [userId];

  try {
    const profileData = await db.one(query, values);
    const majors = await fetchMajors(); // Fetch majors
    res.render('pages/edit-profile', { 
      profile: profileData, 
      majors 
    }); 
  } catch (err) {
    console.log(err);
    res.redirect('/profile');
  }
});

// POST route to handle profile updates
app.post('/edit-profile', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const { major_id, ...profileData } = req.body;

  try {
    await db.tx(async t => {
      // Update profile
      await t.none(`
        UPDATE buffspace_main.profile 
        SET 
          first_name = $1,
          last_name = $2,
          graduation_year = $3,
          bio = $4,
          status = $5,
          profile_picture_url = $6
        WHERE user_id = $7
      `, [
        profileData.first_name, 
        profileData.last_name, 
        profileData.graduation_year, 
        profileData.bio, 
        profileData.status,
        profileData.profile_picture_url,
        userId
      ]);

      // Update student_majors (first remove old major, then add new one)
      await t.none('DELETE FROM buffspace_main.student_majors WHERE user_id = $1', [userId]);
      if (major_id) {
        await t.none('INSERT INTO buffspace_main.student_majors (user_id, major_id) VALUES ($1, $2)', 
          [userId, major_id]);
      }
    });

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    const majors = await fetchMajors();
    res.render('pages/edit-profile', {
      error: true,
      message: 'Error updating profile',
      profile: req.body,
      majors
    });
  }
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
app.get('/create-profile', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const query = `
    SELECT * FROM buffspace_main.profile
    WHERE user_id = $1
  `;

  try {
    const profile = await db.oneOrNone(query, [userId]);
    const majors = await fetchMajors(); // Fetch majors
    if (profile) {
      res.redirect('/profile');
    } else {
      res.render('pages/create-profile', {
        user: req.session.user,
        majors // Pass majors to the view
      });
    }
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// Handle profile creation
app.post('/create-profile', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const { major_id, ...profileData } = req.body;

  try {
    await db.tx(async t => {
      // Insert profile
      await t.none(`
        INSERT INTO buffspace_main.profile
        (user_id, first_name, last_name, graduation_year, bio, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, profileData.first_name, profileData.last_name,
          profileData.graduation_year, profileData.bio, 
          profileData.status]);

      // Insert student_majors
      if (major_id) {
        await t.none(`
          INSERT INTO buffspace_main.student_majors
          (user_id, major_id)
          VALUES ($1, $2)
        `, [userId, major_id]);
      }
    });

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.render('pages/create-profile', {
      error: true,
      message: 'Error creating profile'
    });
  }
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

app.get('/buffcircle', auth, async (req, res) => {
  const userId = req.session.user.user_id;

  try {
    // Fetch the user's profile
    const profileQuery = `
      SELECT * FROM buffspace_main.profile WHERE user_id = $1;
    `;
    const profile = await db.oneOrNone(profileQuery, [userId]);

    // Fetch majors, classes, and interests (assuming you have these tables)
    const majorsQuery = `SELECT * FROM buffspace_main.majors;`;
    const classesQuery = `SELECT * FROM buffspace_main.classes;`;
    const interestsQuery = `SELECT * FROM buffspace_main.interests;`;
    const suggestedFriendsQuery = `
      SELECT u.user_id, u.username, p.profile_picture_url
      FROM buffspace_main.user u
      JOIN buffspace_main.profile p ON u.user_id = p.user_id
      WHERE u.user_id != $1
      LIMIT 8;  // Adjust the limit as needed
    `;

    const [majors, classes, interests, suggestedFriends] = await Promise.all([
      db.any(majorsQuery),
      db.any(classesQuery),
      db.any(interestsQuery),
      db.any(suggestedFriendsQuery, [userId])
    ]);

    // Define sort options
    const sortOptions = [
      { value: "compatibility", label: "Compatibility" },
      { value: "recent", label: "Recent Activity" },
      { value: "classes", label: "Common Classes" }
    ];

    // Render the buffcircle.hbs template with the fetched data
    res.render('pages/buffcircle', {
      profile,
      majors,
      classes,
      interests,
      sortOptions,
      suggestedFriends
    });
  } catch (error) {
    console.error(error);
    res.redirect('/'); // Redirect to home or handle error appropriately
  }
});

app.get('/courses-profile', auth, async (req, res) => {
  const userId = req.session.user.user_id;

  try {
    // Get user's current courses
    const userCoursesQuery = `
      SELECT c.* 
      FROM buffspace_main.courses c
      JOIN buffspace_main.student_courses sc ON c.course_id = sc.course_id
      WHERE sc.user_id = $1
      ORDER BY c.course_id;
    `;

    // Get available courses (not yet added by user)
    const availableCoursesQuery = `
      SELECT c.*
      FROM buffspace_main.courses c
      WHERE c.course_id NOT IN (
        SELECT course_id 
        FROM buffspace_main.student_courses 
        WHERE user_id = $1
      )
      ORDER BY c.course_id;
    `;

    const [userCourses, availableCourses] = await Promise.all([
      db.any(userCoursesQuery, [userId]),
      db.any(availableCoursesQuery, [userId])
    ]);

    res.render('pages/courses-profile', {
      userCourses,
      availableCourses
    });
  } catch (error) {
    console.error(error);
    res.redirect('/profile');
  }
});

// Add a course
app.post('/add-course', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const courseId = req.body.course_id;

  try {
    await db.none(
      'INSERT INTO buffspace_main.student_courses (user_id, course_id) VALUES ($1, $2)',
      [userId, courseId]
    );
    res.redirect('/courses-profile');
  } catch (error) {
    console.error(error);
    res.redirect('/courses-profile');
  }
});

// Remove a course
app.post('/remove-course', auth, async (req, res) => {
  const userId = req.session.user.user_id;
  const courseId = req.body.course_id;

  try {
    await db.none(
      'DELETE FROM buffspace_main.student_courses WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    res.redirect('/courses-profile');
  } catch (error) {
    console.error(error);
    res.redirect('/courses-profile');
  }
});


module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
