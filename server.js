// const express = require("express");
//210050113_lab6_final
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
const port = 13000;

const currentSemester = 'Spring';
const currentYear = 2024;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'univ_lab6',
    password: 'postgres',
    port: 11000,
});



const authorization = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.sendStatus(403);
  }
  try {
    const data = jwt.verify(token, "YOUR_SECRET_KEY");
    
    req.userid = data.id;
    req.role = data.Role;
    return next();
  } catch(err) {
    
    return res.send("User not logged in"); // Forbidden
    
  }
};

app.get("/dashboard.html", authorization, async (req, res) => {
 
   try { const { userid, role } = req;

    // Send the dashboard HTML content along with user information
    const dashboardContent = `
      <h1>Welcome to the Dashboard</h1>
      <p>User ID: ${userid}</p>
      <p>Role: ${role}</p>
    `;
  
  
    
      const query = {
      text: `SELECT t.course_id, t.sec_id
             FROM section AS t
             WHERE t.semester = $1 AND t.year = $2;`,
      values: [currentSemester, currentYear],
    };

    const result = await pool.query(query);

    
    let tableHTML = '<h2>Course Table</h2>';
    tableHTML += '<table border="1"><tr><th>Course ID</th><th>Section ID</th><th>Registration Status</th></tr>';
    console.log(result);
    for (const row of result.rows) {
      const query_2 = {
        text: `SELECT ID
             FROM takes
             WHERE semester = $1 AND year = $2 AND ID = $3 AND course_id = $4 AND sec_id = $5 ;`,
      values: [currentSemester, currentYear , req.userid , row.course_id , row.sec_id],

      };
      const result_2 = await pool.query(query_2);
      if (result_2.rows.length >0){
          tableHTML += `<tr><td>${row.course_id}</td><td>${row.sec_id}</td><td>${'Registered'}</td></tr>`;}
      else {
        tableHTML += `<tr><td>${row.course_id}</td><td>${row.sec_id}</td><td>${'Not Registered'}</td></tr>`;
      }
    }
    tableHTML += '</table>';

    
    const formHTML = `
      <h2>Register for Course</h2>
      <form action="/register.html" method="POST">
          <label for="courseid">Course ID:</label>
          <input type="text" id="courseid" name="courseid"><br>
          <label for="secid">Section ID:</label>
          <input type="text" id="secid" name="secid"><br>
          <button type="submit" id ="register"> Register </button>
      </form>
    `;

    
    const htmlContent = dashboardContent + tableHTML + formHTML;

    
    res.send(htmlContent);
  } catch (err) {
    
    console.error('Error in dashboard route:', err);
    res.sendStatus(403);
  }
});


app.use(express.static(__dirname)); 


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.post('/logincheck', async (req, res) => {
  const { role, userid, password } = req.body;
 
  /////Modified
  const query = {
    text: `SELECT (password_hash = crypt('${password}', password_hash)) AS password_hash
      FROM loginuser 
      WHERE role = '${role}' and (admin_id = '${userid}' or stud_id = '${userid}' or ins_id = '${userid}');`,
  };

  

  try {
      const result = await pool.query(query);
      
      console.log(result.rows[0].password_hash);
      if (result.rows[0].password_hash) {

        
        const token = jwt.sign({ id: userid, Role: role }, "YOUR_SECRET_KEY");
        
        res.cookie("jwt", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
        console.log("4");
      res.send('<meta http-equiv="refresh" content="10; url=/dashboard.html">');
      
        
       } else {
          res.send('login identity did not match');
      }
  } catch (err) {
      res.send('login failure');
  }
});



app.post('/register.html', authorization, async (req, res) => {
  try {
    const { courseid, secid } = req.body;

    const sectionQuery = {
      text: `SELECT * FROM section WHERE course_id = $1 AND sec_id = $2 AND semester = $3 AND year = $4 ;`,
      values: [courseid, secid, currentSemester, currentYear],
    };

    const sectionResult = await pool.query(sectionQuery);
      if (sectionResult.rows.length == 0) {
        return res.send('Registration failed - no such course and section');
    }

    
    const registrationQuery = {
      text: `SELECT * FROM takes WHERE ID = $1 AND course_id = $2 ;`,
      values: [req.userid, courseid],
    };

    const registrationResult = await pool.query(registrationQuery);
    if (registrationResult.rows.length > 0) {
      return res.send('Registration failed - already registered');
    }

		
    const prereqQuery = {
      text: `SELECT p.prereq_id
              FROM prereq as p
              LEFT JOIN takes  ON  takes.ID = $2 
              WHERE p.course_id = $1 and (takes.grade = 'F' OR takes.grade IS NULL) and takes.course_id = p.prereq_id ;`,
      values: [courseid, req.userid],
    };

    const prereqResult = await pool.query(prereqQuery);
    const incompletePrereqs = prereqResult.rows.map(row => row.prereq_id);

    if (incompletePrereqs.length > 0) {
      return res.send(`Registration failed - prereq incomplete: ${incompletePrereqs.join(', ')}`);
    }
    
    const limitQuery = {
      text: `SELECT COUNT(*) AS registrations
             FROM takes
             WHERE course_id = $1 AND sec_id = $2 AND semester = $3 AND year = $4;`,
      values: [courseid, secid, currentSemester, currentYear],
    };
    const limitResult = await pool.query(limitQuery);
    const registrationsCount = limitResult.rows[0].registrations;

    const sectionLimitQuery = {
      text: `SELECT registration_limit
             FROM section
             WHERE course_id = $1 AND sec_id = $2 AND semester = $3 AND year = $4;`,
      values: [courseid, secid, currentSemester, currentYear],
    };
    const sectionLimitResult = await pool.query(sectionLimitQuery);
    const registrationLimit = sectionLimitResult.rows[0].registration_limit;

    if (registrationsCount >= registrationLimit) {
      return res.send('Registration failed - limit exceeded');
    }

    // Introduce a 30-second gap
    const sleepQuery = {
      text: 'SELECT pg_sleep(30);',
    };
    await pool.query(sleepQuery);
        
      const insertQuery = {
          text: `INSERT INTO takes (ID, course_id, sec_id, semester, year) VALUES ($1, $2, $3, $4, $5);`,
          values: [req.userid, courseid, secid, currentSemester, currentYear],
        };
        await pool.query(insertQuery);
  
  
        return res.send('Course registration successful');
       
     
    }catch(err) {
      console.error('Error in course registration:', err);
      res.send('Registration Unsuccessful');
    }
    
    
  });
    
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});













