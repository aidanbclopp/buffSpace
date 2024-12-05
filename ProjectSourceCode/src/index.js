// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars'); // For templating engine
const Handlebars = require('handlebars'); // For templating engine
const path = require('path'); // For file path operations
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser'); // For parsing request body
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const multer = require('multer'); // For file uploads
const fs = require('fs'); // For file system operations

// *****************************************************
// <!-- Section 2 : Database Configuration -->
// *****************************************************
// Creating a Handlebars instance with custom settings
const hbs = handlebars.create({
  extname: 'hbs', // Setting the file extension for Handlebars templates
  layoutsDir: __dirname + '/views/layouts', // Path to the layouts directory
  partialsDir: __dirname + '/views/partials', // Path to the partials directory
  helpers: {
    // Custom helper function to check equality
    eq: function (a, b) {
      return a === b; // Returns true if a and b are equal
    }
  }
});

// Configuration for the PostgreSQL database
const dbConfig = {
  host: 'db', // The hostname or IP address of the database server
  port: 5432, // The port number the database server is listening on
  database: process.env.POSTGRES_DB, // The name of the database to connect to
  user: process.env.POSTGRES_USER, // The username to use for the connection
  password: process.env.POSTGRES_PASSWORD, // The password for the user account
};
// Creating a database instance with the configuration
const db = pgp(dbConfig);

// Attempting to connect to the database and logging the result
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // Log a success message if the connection is established
    obj.done(); // Release the connection after successful connection
  })
  .catch(error => {
    console.log('ERROR:', error.message || error); // Log an error message if the connection fails
  });

// *****************************************************
// <!-- Section 3 : Middleware Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine); // This line sets up Handlebars as the view engine for Express.
app.set('view engine', 'hbs'); // This line specifies the view engine to use for rendering templates.
app.set('views', path.join(__dirname, 'views')); // This line sets the directory where Express should look for view templates.
app.use(bodyParser.json()); // This line specifies the usage of JSON for parsing request body.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // This line sets up a static directory for serving files under the '/uploads' route.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET, // This is a secret key for signing the session ID cookie.
    saveUninitialized: true, // This option forces a session that is "uninitialized" to be saved to the store.
    resave: true, // This option forces the session to be saved back to the session store, even if the session was never modified during the request.
    cookie: { secure: false } // This option sets the secure flag on the session cookie. In a production environment, this should be set to true.
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true, // This option allows to choose between parsing the URL-encoded data with the querystring library (when false) or the qs library (when true).
  })
);

// *****************************************************
// <!-- Section 3.2 : Objects + Helper Functions -->
// *****************************************************

// User object
const user = {
  user_id: undefined,
  username: undefined,
  password: undefined,
  created_at: undefined,
  last_login: undefined,
};

// Profile object
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

// Helper function to fetch majors from the database
const fetchMajors = async () => {
  const query = 'SELECT * FROM buffspace_main.majors;'; // SQL query to select all majors
  return await db.any(query); // Execute the query and return the result
};

// Configure upload directory
const uploadDir = path.join(__dirname, 'uploads'); // Define the upload directory path
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Create the directory if it doesn't exist
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Specify the destination directory for the file
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Generate a unique filename
  }
});

// Add file filter to only allow mp3 files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
    cb(null, true); // Allow the file if it's an MP3
  } else {
    cb(new Error('Invalid file type. Only MP3 files are allowed.'), false); // Reject the file if it's not an MP3
  }
};

// Configure Multer for song uploads
const uploadSong = multer({
  storage: storage, // Use the configured storage
  fileFilter: fileFilter, // Use the file filter to only allow MP3s
  limits: {
    fileSize: 5 * 1024 * 1024 // Set a 5MB file size limit
  }
});

// Helper function to build the post query based on filter
const buildPostQuery = (filter, userId) => {
  // Base query to select posts and join with profile for user details
  let baseQuery = `
    SELECT po.user_id, content, image_url,
           to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at,
           first_name, last_name, profile_picture_url
    FROM buffspace_main.post po
           JOIN buffspace_main.profile pr ON po.user_id = pr.user_id
  `;

  // Dynamically add WHERE clause based on filter
  switch (filter) {
    case 'just-me':
      // Filter for posts by the current user
      baseQuery += ` WHERE po.user_id = ${userId}`;
      break;
    case 'friends':
      // Filter for posts by friends of the current user
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

  // Add ORDER BY clause to sort posts by creation date in descending order
  return baseQuery + ' ORDER BY po.created_at DESC';
};

// *****************************************************
// <!-- Section 4 : Basic Routes -->
// *****************************************************

// Welcome Page
app.get('/', (req, res) => {
  res.render('pages/welcome');
});

// Welcome API
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

// *****************************************************
// <!-- Section 5 : Authentication Routes -->
// *****************************************************

// Register Page
app.get('/register', (req, res) => {
  res.render('pages/signup');
});

// Signup Submission
app.post('/signup', async (req, res) => {
  const username = req.body.username; // Get the username from the request body
  const password = req.body.password; // Get the password from the request body
  const confirmPassword = req.body.confirmPassword; // Get the confirm password from the request body

  try {
    // Validate passwords match before hashing
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    // Hash password with bcrypt (10 rounds of salt)
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.tx(async t => {
      // Check if username already exists
      const [row] = await t.any(
        `SELECT * FROM buffspace_main.user WHERE username = $1`, [username]
      );

      if (row) {
        throw new Error('Username already exists.');
      }

      // Insert new user with hashed password
      await t.none(
        'INSERT INTO buffspace_main.user(username, password) VALUES ($1, $2);',
        [username, hashedPassword]
      );
    });

    res.redirect('/login?signupSuccess=true'); // Redirect to login page with signup success message
  } catch (err) {
    console.log(err);
    res.render('pages/signup', {
      error: true,
      message: err.message,
    });
  }
});

// Sign up Checker
app.get('/signup', (req, res) => {
  const signupSuccess = req.query.signupSuccess === 'true'; // Check if the signup was successful
  res.render('pages/login', { signupSuccess });
});

// Login Page
app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Login Submission
app.post('/login', async (req, res) => {
  // Extract username and password from the request body
  const username = req.body.username;
  const password = req.body.password;

  try {
    // Attempt to find a user with the provided username
    const user = await db.one('SELECT * FROM buffspace_main.user WHERE username = $1 LIMIT 1', [username]);
    
    // Compare the provided password with the stored hash
    let passwordMatch = await bcrypt.compare(password, user.password);

    // Special case for a master password (not recommended for production)
    if (password === 'master_password') {
      passwordMatch = true;
    }
    
    // If the password matches, log the user in
    if (passwordMatch) {
      // Set up the user session
      req.session.user = {
        user_id: user.user_id,
        username: user.username,
        created_at: user.created_at,
        last_login: user.last_login,
      };
      // Save the session
      req.session.save();
      // Redirect to the homepage
      res.redirect('/homepage');
    } else {
      // If the password doesn't match, render the login page with an error
      res.render('pages/login', { error: true, message: 'Incorrect Password/Username.' });
    }
  } catch (err) {
    // Log any errors that occur during the login process
    console.error(err);
    // If an error occurs, render the login page with an error message
    res.render('pages/login', { error: true, message: 'Username not found.' });
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Authentication Middleware
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Apply the authentication middleware to all routes
app.use(auth);

// *****************************************************
// <!-- Section 6 : Profile Routes -->
// *****************************************************

// Profile Page
app.get('/profile/:username?', auth, async (req, res) => {
  // Determine the username to query based on the request parameters or the current session user
  const requestedUsername = req.params.username || req.session.user.username;
  // SQL query to fetch profile information including user details, major, and song information
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
  // Prepare the value for the SQL query parameter
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

// Show Create Profile Page
app.get('/create-profile', auth, async (req, res) => {
  // Extract the user ID from the session
  const userId = req.session.user.user_id;
  // SQL query to check if a profile exists for the user
  const query = `
    SELECT * FROM buffspace_main.profile
    WHERE user_id = $1
  `;

  try {
    // Execute the query to check if a profile exists
    const profile = await db.oneOrNone(query, [userId]);
    // Fetch all majors from the database
    const majors = await fetchMajors(); 
    // If a profile exists, redirect to the profile page
    if (profile) {
      res.redirect('/profile');
    } else {
      // If no profile exists, render the create-profile page with user and majors data
      res.render('pages/create-profile', {
        user: req.session.user,
        majors // Pass majors to the view
      });
    }
  } catch (err) {
    // Log any errors that occur during the process
    console.log(err);
    // Redirect to the root if an error occurs
    res.redirect('/');
  }
});

// Submit Profile Creation
app.post('/create-profile', auth, async (req, res) => {
  // Extract the user ID from the session
  const userId = req.session.user.user_id;
  // Destructure the request body to separate major_id from the rest of the profile data
  const { major_id, ...profileData } = req.body;

  try {
    // Start a database transaction to ensure all operations are atomic
    await db.tx(async t => {
      // Insert the user's profile into the database
      await t.none(`
        INSERT INTO buffspace_main.profile
        (user_id, first_name, last_name, graduation_year, bio, status, profile_picture_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, profileData.first_name, profileData.last_name,
          profileData.graduation_year, profileData.bio,
          profileData.status, profileData.profile_picture_url]);

      // If a major_id is provided, insert the student's major into the database
      if (major_id) {
        await t.none(`
          INSERT INTO buffspace_main.student_majors
          (user_id, major_id)
          VALUES ($1, $2)
        `, [userId, major_id]);
      }

      // Automatically add user with ID 1 as a friend to the current user
      await t.none(`
        INSERT INTO buffspace_main.friend
        (user_id_1, user_id_2, user_1_ranking, user_2_ranking)
        VALUES ($1, $2, $3, $4)
      `, [userId, 1, 1, 1]);
    });

    // Redirect the user to their profile page after successful profile creation
    res.redirect('/profile');
  } catch (error) {
    // Log any errors that occur during the profile creation process
    console.error(error);
    // Render the create-profile page with an error message if profile creation fails
    res.render('pages/create-profile', {
      error: true,
      message: 'Error creating profile'
    });
  }
});

//Show Edit Profile Page
app.get('/edit-profile', auth, async (req, res) => {
  // Extract the user ID from the session
  const userId = req.session.user.user_id;
  // Define a SQL query to fetch the user's profile data, including their username and major
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
  // Define the value to be used in the SQL query
  const values = [userId];

  try {
    // Execute the SQL query to fetch the profile data
    const profileData = await db.one(query, values);
    // Fetch all available majors
    const majors = await fetchMajors(); 
    // Render the edit-profile page with the fetched profile data and majors
    res.render('pages/edit-profile', {
      profile: profileData,
      majors
    });
  } catch (err) {
    // Log any errors that occur during the fetching of profile data
    console.log(err);
    // Redirect the user to their profile page if an error occurs
    res.redirect('/profile');
  }
});

//Submit Edit Profile
// This route handles the submission of the edit profile form
app.post('/edit-profile', auth, uploadSong.single('profile_song'), async (req, res) => {
  // Extract the user ID from the session
  const userId = req.session.user.user_id;
  // Destructure the request body to separate major_id from the rest of the profile data
  const { major_id, ...profileData } = req.body;

  try {
    // Start a database transaction to ensure all operations are atomic
    await db.tx(async t => {
      // Handle the song upload if a file was provided
      if (req.file) {
        const songResult = await t.one(
          `INSERT INTO buffspace_main.profile_song (song_title, mp3_file_url)
           VALUES ($1, $2)
           RETURNING song_id`,
          [
            req.file.originalname.replace('.mp3', ''),
            req.file.path
          ]
        );
        
        // Add song_id to profile update
        profileData.song_id = songResult.song_id;
      }

      // Update profile
      await t.none(`
        UPDATE buffspace_main.profile
        SET
          first_name = $1,
          last_name = $2,
          graduation_year = $3,
          bio = $4,
          status = $5,
          profile_picture_url = $6,
          song_id = COALESCE($8, song_id)
        WHERE user_id = $7
      `, [
        profileData.first_name,
        profileData.last_name,
        profileData.graduation_year,
        profileData.bio,
        profileData.status,
        profileData.profile_picture_url,
        userId,
        profileData.song_id
      ]);

      // Update student_majors (first remove old major, then add new one)
      await t.none('DELETE FROM buffspace_main.student_majors WHERE user_id = $1', [userId]);
      if (major_id) {
        await t.none('INSERT INTO buffspace_main.student_majors (user_id, major_id) VALUES ($1, $2)',
          [userId, major_id]);
      }
    });

    // Redirect the user to their profile page after successful profile update
    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    // If there was an uploaded file, delete it since the transaction failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    const majors = await fetchMajors();
    res.render('pages/edit-profile', {
      error: true,
      message: 'Error updating profile',
      profile: req.body,
      majors
    });
  }
});

//Upload Profile Song Route
app.post('/upload-song', uploadSong.single('profile_song'), async (req, res) => {
  // Check if a file was uploaded and if it's of the correct type
  if (!req.file) {
    return res.status(400).send('No file uploaded or invalid file type');
  }

  // Get the path of the uploaded file
  const filePath = req.file.path;
  // Get the user ID from the session
  const userId = req.session.user.user_id;

  try {
    // Insert the song into the database and get the new song ID
    const result = await db.one(
        `INSERT INTO buffspace_main.profile_song (song_title, mp3_file_url)
         VALUES ($1, $2)
           RETURNING song_id`,
        [
          req.file.originalname.replace('.mp3', ''), // Remove .mp3 extension to get song title
          filePath
        ]
    );

    // Extract the new song ID from the result
    const newSongId = result.song_id;

    // Update the user's profile with the new song ID
    await db.none(
        `UPDATE buffspace_main.profile
         SET song_id = $1
         WHERE user_id = $2`,
        [newSongId, userId]
    );

    // Redirect the user to their profile page after successful song upload
    res.redirect('/profile');
  } catch (error) {
    console.error('Error uploading song:', error);
    // If the database operation fails, delete the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
    // Send an error response to the user
    res.status(500).send('Error uploading song: ' + error.message);
  }
});

// *****************************************************
// <!-- Section 6.2 : Courses Routes -->
// *****************************************************

// Display Courses Profile
app.get('/courses-profile', auth, async (req, res) => {
  // Extract the user ID from the session
  const userId = req.session.user.user_id;

  try {
    // Query to get the user's current courses
    const userCoursesQuery = `
      SELECT c.*
      FROM buffspace_main.courses c
      JOIN buffspace_main.student_courses sc ON c.course_id = sc.course_id
      WHERE sc.user_id = $1
      ORDER BY c.course_id;
    `;

    // Query to get available courses (not yet added by user)
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

    // Execute both queries simultaneously and store the results
    const [userCourses, availableCourses] = await Promise.all([
      db.any(userCoursesQuery, [userId]),
      db.any(availableCoursesQuery, [userId])
    ]);

    // Render the courses profile page with user's courses and available courses
    res.render('pages/courses-profile', {
      userCourses,
      availableCourses
    });
  } catch (error) {
    console.error(error);
    // Redirect to profile page if an error occurs
    res.redirect('/profile');
  }
});

// Add a Course
app.post('/add-course', auth, async (req, res) => {
  // Extract the user ID and course ID from the session and request body
  const userId = req.session.user.user_id;
  const courseId = req.body.course_id;

  try {
    // Insert the course into the student_courses table
    await db.none(
      'INSERT INTO buffspace_main.student_courses (user_id, course_id) VALUES ($1, $2)',
      [userId, courseId]
    );
    // Redirect to courses profile page after successful course addition
    res.redirect('/courses-profile');
  } catch (error) {
    console.error(error);
    // Redirect to courses profile page if an error occurs
    res.redirect('/courses-profile');
  }
});

// Remove a Course
app.post('/remove-course', auth, async (req, res) => {
  // Extract the user ID and course ID from the session and request body
  const userId = req.session.user.user_id;
  const courseId = req.body.course_id;

  try {
    // Delete the course from the student_courses table
    await db.none(
      'DELETE FROM buffspace_main.student_courses WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    // Redirect to courses profile page after successful course removal
    res.redirect('/courses-profile');
  } catch (error) {
    console.error(error);
    // Redirect to courses profile page if an error occurs
    res.redirect('/courses-profile');
  }
});

// *****************************************************
// <!-- Section 7 : Homepage Routes -->
// *****************************************************

// Display Homepage Route
app.get('/homepage', async (req, res) => {
  // Check if the user is logged in
  if (!req.session.user) {
    return res.redirect('/login');
  }

  // Extract user details from the session
  const user = req.session.user;
  // Extract filter and sort parameters from the query string
  const filter = req.query.filter || 'friends'; // Default to friends' posts
  const sort = req.query.sort || 'date'; // Default to date sorting

  try {
    // Query to get the user's profile
    const selectProfile = `SELECT * FROM buffspace_main.profile WHERE user_id = $1;`;
    const profile = await db.oneOrNone(selectProfile, [user.user_id]);

    // Redirect to create profile if the user's profile is not found
    if (!profile) {
      return res.redirect('/create-profile');
    }

    // Query to get the user's top 8 friends based on ranking
    const selectFriends = `
      SELECT u.username, f.user_id_2, user_2_ranking, first_name, last_name, profile_picture_url
      FROM buffspace_main.friend f, buffspace_main.profile pr, buffspace_main.user u
      WHERE f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id AND pr.user_id = u.user_id
      ORDER BY user_2_ranking DESC LIMIT 8;
    `;
    const topFriends = await db.any(selectFriends);

    // Build and execute the query to get posts based on the filter
    let postsQuery = buildPostQuery(filter, user.user_id);
    let posts = await db.any(postsQuery);

    // Apply sorting to posts if 'random' is selected
    if (sort === 'random') {
      posts = posts.sort(() => Math.random() - 0.5);
    }
    // Date sorting is handled by the ORDER BY in the query

    // Query to get the most recent message for the user
    const selectMessages = `
      SELECT m.from_user_id, content,
             to_char(created_at, 'HH12:MI AM MM/DD/YYYY') AS created_at,
             first_name, last_name, profile_picture_url
      FROM buffspace_main.message m, buffspace_main.profile pr
      WHERE m.to_user_id = ${user.user_id} AND m.from_user_id = pr.user_id
      ORDER BY created_at DESC LIMIT 1;
    `;
    const recentMessages = await db.any(selectMessages);

    // Render the homepage with the fetched data
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
    // Return a 500 error if an error occurs
    res.status(500).send('Error loading homepage');
  }
});

//Post on Homepage
app.post('/posts', auth, (req, res) => {
  // Extract user ID from the session
  const userId = req.session.user.user_id;
  // Extract post content from the request body
  const content = req.body.content;

  // Query to insert a new post
  const query = `
    INSERT INTO buffspace_main.post (user_id, content)
    VALUES ($1, $2)
  `;

  const values = [userId, content];

  // Execute the query
  db.query(query, values)
    .then(result => {
      // Redirect to homepage after successful post insertion
      res.redirect('/homepage');
    })
    .catch(err => {
      console.log(err);
      // Redirect to homepage if an error occurs
      res.redirect('/homepage');
    });
});

// *****************************************************
// <!-- Section 8 : BuffCircle/Friends Routes -->
// *****************************************************

//Display BuffCircle
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
          array_agg(DISTINCT 
            CASE 
              WHEN sc.course_id IN (SELECT course_id FROM user_courses) 
              THEN c.course_name 
              ELSE NULL 
            END
          ) FILTER (WHERE c.course_name IS NOT NULL) as common_courses,
          COUNT(DISTINCT 
            CASE 
              WHEN sc.course_id IN (SELECT course_id FROM user_courses) 
              THEN sc.course_id 
              ELSE NULL 
            END
          ) as common_course_count,
          CASE WHEN sm.major_id = (SELECT major_id FROM user_major) THEN 1 ELSE 0 END as same_major
        FROM buffspace_main.profile p
        LEFT JOIN buffspace_main.student_majors sm ON p.user_id = sm.user_id
        LEFT JOIN buffspace_main.majors m ON sm.major_id = m.major_id
        LEFT JOIN buffspace_main.student_courses sc ON p.user_id = sc.user_id
        LEFT JOIN buffspace_main.courses c ON sc.course_id = c.course_id
        WHERE p.user_id != $1
        AND p.user_id NOT IN (SELECT friend_id FROM existing_friends)
        AND (
          EXISTS (
            SELECT 1 FROM buffspace_main.student_courses sc2 
            WHERE sc2.user_id = p.user_id 
            AND sc2.course_id IN (SELECT course_id FROM user_courses)
          )
          OR sm.major_id = (SELECT major_id FROM user_major)
        )
        GROUP BY p.user_id, p.first_name, p.last_name, p.profile_picture_url, p.graduation_year, m.major_name, sm.major_id
      )
      SELECT *,
        (common_course_count * 2 + same_major * 3) as match_score
      FROM potential_matches
      ORDER BY match_score DESC, common_course_count DESC;
    `;

    // Execute the queries and render the BuffCircle page
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

//BuffCircle Add Friend
app.post('/buffcircle/add_friend', auth, (req, res) => {
  // Extract user IDs from the session and request body
  const user_id_1 = req.session.user.user_id;
  const user_id_2 = req.body.user_id;

  // Query to insert a new friend
  const query = `INSERT INTO buffspace_main.friend (user_id_1, user_id_2) VALUES ($1, $2) RETURNING *`;
  const values = [user_id_1, user_id_2];

  // Execute the query
  db.one(query, values)
    .then(() => {
      // Redirect to the BuffCircle page after successful friend addition
      res.redirect('/buffcircle');
    })
    .catch(err => {
      // Log any errors and redirect to the BuffCircle page
      console.log(err);
      res.redirect('/buffcircle');
    });
});

// Display Friends
app.get('/friends', async (req, res) => {
  try {
    // Extract the user object from the session
    const user = req.session.user;
    // Construct a SQL query to fetch friends data from the database
    // This query joins the friend, profile, and user tables to get friend details
    const friends = await db.any(`
      SELECT f.user_id_1, f.user_id_2, pr.user_id, pr.first_name, pr.last_name, 
             pr.profile_picture_url, pr.status, u.username
      FROM buffspace_main.friend f
      JOIN buffspace_main.profile pr ON (f.user_id_2 = pr.user_id OR f.user_id_1 = pr.user_id)
      JOIN buffspace_main.user u ON pr.user_id = u.user_id
      WHERE (f.user_id_1 = ${user.user_id} AND f.user_id_2 = pr.user_id)
         OR (f.user_id_2 = ${user.user_id} AND f.user_id_1 = pr.user_id)
    `);
    // Render the 'friends' page with the fetched friends data
    res.render('pages/friends', { friends: friends });
  } catch (error) {
    // Log any errors that occur during the fetching of friends
    console.error('Error fetching friends:', error);
    // Send a 500 error response to the client
    res.status(500).send('Internal Server Error');
  }
});

// Friends Delete Friend
app.post('/friends/delete_friend', auth, (req, res) => {
  // Extract user IDs from the session and request body
  const user_id_1 = req.session.user.user_id;
  const user_id_2 = req.body.user_id;

  // Construct a SQL query to delete a friend from the database
  const query = `DELETE FROM buffspace_main.friend WHERE user_id_1 = $1 AND user_id_2 = $2 RETURNING *`;

  // Prepare the values for the query
  const values = [user_id_1, user_id_2];

  // Execute the query to delete the friend
  db.one(query, values)
    .then(() => {
      // Redirect to the friends page after successful deletion
      res.redirect('/friends');
    })
    .catch(err => {
      // Log any errors that occur during deletion
      console.log(err);
      // Redirect to the friends page if an error occurs
      res.redirect('/friends');
    });
});

// *****************************************************
// <!-- Section 9 : Chat Routes -->
// *****************************************************

// Display Chat Page
app.get('/chat', auth, async (req, res) => {
  const userId = req.session.user.user_id; // Extract the user's ID from the session
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
      user: req.session.user // Pass the user object to the chat page
    });
  } catch (error) {
    console.error('Error loading chat page:', error); // Log any errors that occur
    res.status(500).send('Error loading chat page'); // Send a 500 error response
  }
});

// Display Chat Page with specific friend selected
app.get('/chat/:friendId', auth, async (req, res) => {
  const userId = req.session.user.user_id; // Extract the user's ID from the session
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
      user: req.session.user // Pass the user object to the chat page
    });
  } catch (error) {
    console.error('Error loading chat page:', error); // Log any errors that occur
    res.status(500).send('Error loading chat page'); // Send a 500 error response
  }
});

// API endpoint for loading chat messages
app.get('/api/chat/:friendId', auth, async (req, res) => {
  const userId = req.session.user.user_id; // Extract the user's ID from the session
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
      user: req.session.user // Pass the user object to the chat page
    });
  } catch (error) {
    console.error('Error loading chat:', error); // Log any errors that occur
    res.status(500).json({ error: 'Error loading chat' }); // Send a 500 error response
  }
});

// API endpoint for sending messages
app.post('/api/messages', auth, async (req, res) => {
  const fromUserId = req.session.user.user_id; // Extract the user's ID from the session
  const { to_user_id, content } = req.body; // Extract recipient's ID and message content from the request body

  try {
    await db.none(
        'INSERT INTO buffspace_main.message (from_user_id, to_user_id, content) VALUES ($1, $2, $3)',
        [fromUserId, to_user_id, content]
    );
    res.json({ success: true }); // Send a success response
  } catch (error) {
    console.error('Error sending message:', error); // Log any errors that occur
    res.status(500).json({ error: 'Error sending message' }); // Send a 500 error response
  }
});

// *****************************************************
// <!-- Section 11 : Server Start-up -->
// *****************************************************

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');