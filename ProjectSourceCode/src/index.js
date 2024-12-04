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
const multer = require('multer');
const fs = require('fs');


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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  const signupSuccess = req.query.signupSuccess === 'true'; // Check if the signup was successful
  res.render('pages/login', { signupSuccess });
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
      res.redirect('/login?signupSuccess=true');
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

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Add file filter to only allow mp3 files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP3 files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Modified upload route
app.post('/upload-song', upload.single('mp3'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded or invalid file type');
  }

  const filePath = req.file.path;
  const userId = req.session.user.user_id;

  try {
    const result = await db.one(
        `INSERT INTO buffspace_main.profile_song (song_title, mp3_file_url)
         VALUES ($1, $2)
           RETURNING song_id`,
        [
          req.file.originalname.replace('.mp3', ''),
          filePath
        ]
    );

    const newSongId = result.song_id;

    // Update the user's profile with the new song ID
    await db.none(
        `UPDATE buffspace_main.profile
         SET song_id = $1
         WHERE user_id = $2`,
        [newSongId, userId]
    );

    res.redirect('/profile');
  } catch (error) {
    console.error('Error uploading song:', error);
    // Delete the uploaded file if database operation fails
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
    res.status(500).send('Error uploading song: ' + error.message);
  }
});




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
        m.major_id,
      ps.mp3_file_url,
      ps.song_title,
      CASE
        WHEN ps.mp3_file_url IS NOT NULL
          THEN REPLACE(ps.mp3_file_url, '/home/node/app/src', '')
        END as song_url
    FROM buffspace_main.profile p
    JOIN buffspace_main.user u ON p.user_id = u.user_id
    LEFT JOIN buffspace_main.profile_song ps ON p.song_id = ps.song_id
    LEFT JOIN buffspace_main.student_majors sm ON sm.user_id = u.user_id
    LEFT JOIN buffspace_main.majors m ON sm.major_id = m.major_id
    WHERE u.username = $1
  `;
  const values = [requestedUsername];

  db.one(query, values)
      .then(profileData => {
        // Format the profile data to include song information
        const profile = {
          ...profileData,
          song: profileData.song_title, // Add song title for display
          song_url: profileData.song_url // Add processed URL for audio player
        };

        res.render('pages/profile', {
          profile: profile,
          isOwnProfile: profileData.user_id === req.session.user.user_id
        });
      })
      .catch(err => {
        console.log(err);
        res.render('pages/create-profile');
      });
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

// Helper function to build the post query based on filter
const buildPostQuery = (filter, userId) => {
  let baseQuery = `
    SELECT po.user_id, content, image_url,
           to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at,
           first_name, last_name, profile_picture_url
    FROM buffspace_main.post po
           JOIN buffspace_main.profile pr ON po.user_id = pr.user_id
  `;

  switch (filter) {
    case 'just-me':
      baseQuery += ` WHERE po.user_id = ${userId}`;
      break;
    case 'friends':
      baseQuery += `
        WHERE po.user_id IN (
          SELECT user_id_2
          FROM buffspace_main.friend
          WHERE user_id_1 = ${userId}
        ) OR po.user_id = ${userId}
      `;
      break;
    case 'all':
      // No WHERE clause needed - show all posts
      break;
    default:
      // Default to friends' posts if no valid filter
      baseQuery += `
        WHERE po.user_id IN (
          SELECT user_id_2
          FROM buffspace_main.friend
          WHERE user_id_1 = ${userId}
        ) OR po.user_id = ${userId}
      `;
  }

  return baseQuery + ' ORDER BY po.created_at DESC';
};

// Update the homepage route to handle filters
app.get('/homepage', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  const filter = req.query.filter || 'friends'; // Default to friends' posts
  const sort = req.query.sort || 'date'; // Default to date sorting

  try {
    // Get user profile
    const selectProfile = `SELECT * FROM buffspace_main.profile WHERE user_id = $1;`;
    const profile = await db.oneOrNone(selectProfile, [user.user_id]);

    if (!profile) {
      return res.redirect('/create-profile');
    }

    // Get friends
    const selectFriends = `
      SELECT f.user_id_2, user_2_ranking, first_name, last_name, profile_picture_url
      FROM buffspace_main.friend f, buffspace_main.profile pr
      WHERE f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id
      ORDER BY user_2_ranking DESC LIMIT 8;
    `;
    const topFriends = await db.any(selectFriends);

    // Get posts with filter
    let postsQuery = buildPostQuery(filter, user.user_id);
    let posts = await db.any(postsQuery);

    // Apply sorting
    if (sort === 'random') {
      posts = posts.sort(() => Math.random() - 0.5);
    }
    // Date sorting is handled by the ORDER BY in the query

    // Get messages
    const selectMessages = `
      SELECT m.from_user_id, content,
             to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at,
             first_name, last_name, profile_picture_url
      FROM buffspace_main.message m, buffspace_main.profile pr
      WHERE m.to_user_id = ${user.user_id} AND m.from_user_id = pr.user_id
      ORDER BY created_at DESC LIMIT 1;
    `;
    const recentMessages = await db.any(selectMessages);

    res.render('pages/homepage', {
      profile,
      topFriends,
      posts,
      recentMessages,
      activeFilter: filter,
      activeSort: sort
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).send('Error loading homepage');
  }
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
    // Get current user's profile, major, and courses
    const userProfileQuery = `
      SELECT
        p.*,
        m.major_id,
        m.major_name,
        array_agg(DISTINCT c.course_name) as enrolled_courses
      FROM buffspace_main.profile p
      LEFT JOIN buffspace_main.student_majors sm ON p.user_id = sm.user_id
      LEFT JOIN buffspace_main.majors m ON sm.major_id = m.major_id
      LEFT JOIN buffspace_main.student_courses sc ON p.user_id = sc.user_id
      LEFT JOIN buffspace_main.courses c ON sc.course_id = c.course_id
      WHERE p.user_id = $1
      GROUP BY p.profile_id, m.major_id, m.major_name;
    `;

    // Find potential matches based on shared majors and courses
    const matchesQuery = `
      WITH user_courses AS (
        SELECT course_id FROM buffspace_main.student_courses WHERE user_id = $1
      ),
      user_major AS (
        SELECT major_id FROM buffspace_main.student_majors WHERE user_id = $1
      ),
      existing_friends AS (
        SELECT user_id_2 as friend_id FROM buffspace_main.friend WHERE user_id_1 = $1
        UNION
        SELECT user_id_1 as friend_id FROM buffspace_main.friend WHERE user_id_2 = $1
      ),
      potential_matches AS (
        SELECT
          p.user_id,
          p.first_name,
          p.last_name,
          p.profile_picture_url,
          p.graduation_year,
          m.major_name,
          array_agg(DISTINCT c.course_name) as common_courses,
          COUNT(DISTINCT sc.course_id) as common_course_count,
          CASE WHEN sm.major_id = (SELECT major_id FROM user_major) THEN 1 ELSE 0 END as same_major
        FROM buffspace_main.profile p
        LEFT JOIN buffspace_main.student_majors sm ON p.user_id = sm.user_id
        LEFT JOIN buffspace_main.majors m ON sm.major_id = m.major_id
        LEFT JOIN buffspace_main.student_courses sc ON p.user_id = sc.user_id
        LEFT JOIN buffspace_main.courses c ON sc.course_id = c.course_id
        WHERE p.user_id != $1
        AND p.user_id NOT IN (SELECT friend_id FROM existing_friends)
        AND (
          sc.course_id IN (SELECT course_id FROM user_courses)
          OR sm.major_id = (SELECT major_id FROM user_major)
        )
        GROUP BY p.user_id, p.first_name, p.last_name, p.profile_picture_url, p.graduation_year, m.major_name, sm.major_id
      )
      SELECT *,
        (common_course_count * 2 + same_major * 3) as match_score
      FROM potential_matches
      ORDER BY match_score DESC, common_course_count DESC;
    `;

    const [userProfile, matches] = await Promise.all([
      db.one(userProfileQuery, [userId]),
      db.any(matchesQuery, [userId])
    ]);

    res.render('pages/buffcircle', {
      userProfile,
      matches,
      title: 'BuffCircle'
    });

  } catch (error) {
    console.error('Error in /buffcircle:', error);
    res.redirect('/homepage');
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

app.get('/friends', async (req, res) => {
  try {
    const user = req.session.user;
    // Fetch friends data from the database
    const friends = await db.any(`
      SELECT f.user_id_1, f.user_id_2, pr.user_id, pr.first_name, pr.last_name, pr.profile_picture_url, pr.status
      FROM buffspace_main.friend f, buffspace_main.profile pr
      WHERE f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id OR f.user_id_2 = ${user.user_id} AND f.user_id_1 = pr.user_id
    `);
    // Render the page and pass the friends data to the Handlebars template
    res.render('pages/friends', { friends: friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/buffcircle/add_friend', auth, (req, res) => {
  const user_id_1 = req.session.user.user_id;
  const user_id_2 = req.body.user_id;

  const query = `INSERT INTO buffspace_main.friend (user_id_1, user_id_2) VALUES ($1, $2) RETURNING *`;
  const values = [user_id_1, user_id_2];

  db.one(query, values)
    .then(() => {
      res.redirect('/buffcircle');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/buffcircle');
    });
});
  

//delete friends
app.post('/friends/delete_friend', auth, (req, res) => {
  const user_id_1 = req.session.user.user_id;
  const user_id_2 = req.body.user_id;

  const query = `DELETE FROM buffspace_main.friend WHERE user_id_1 = $1 AND user_id_2 = $2 RETURNING *`;

  const values = [user_id_1, user_id_2];

  db.one(query, values)
    .then(() => {
      res.redirect('/friends');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/friends');
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
