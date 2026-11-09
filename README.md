# CampusCare — Student Complaint Box

A full-stack college complaint management website built with HTML, CSS, JavaScript, Node.js and Express. It uses a local JSON file as its database, so you do not need to install MySQL or MongoDB.

## Requirements
- Node.js 18 or newer
- Internet connection for the first dependency installation

## Run the website
1. Extract `student-complaint-box.zip`.
2. Open the extracted `student-complaint-box` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm start
   ```

5. Open **http://localhost:3000** in Chrome.

Keep the terminal running while using the website. Press `Ctrl + C` to stop the server.

## Admin login (demo)
- Email: `admin@college.edu`
- Password: `Admin@123`

## Student login
Choose **Create account**, enter a name, email and password (minimum 6 characters), then sign in.

## Features
- Student registration and login; passwords are hashed with bcrypt.
- Submit complaints with title, description, category and required priority.
- Students see only their own complaints and their status updates.
- Admin sees all complaints and can change status, priority and add an update note.
- Search and status/priority filters.
- Dashboard counts for total, pending, in-progress and resolved.
- Admin list sorts High priority complaints first.
- Old complaints without a priority are treated as Medium.

## Priority guidance
- **Low:** minor inconvenience; can be handled during routine maintenance.
- **Medium:** affects normal campus activity and needs attention soon.
- **High:** urgent issue, major disruption or possible safety risk.

The student chooses an initial priority. The administrator can review and change it.

## Data storage
Data is saved in `data/db.json`. Back up this file before deleting or moving the project. The server creates it automatically on first start.

## Important before public deployment
This is a hackathon/demo starter. Before exposing it to the public internet:
- Set a long, private `JWT_SECRET` environment variable.
- Change the seeded admin password and provide a secure admin-creation process.
- Use HTTPS and a production database with backups.
- Add email verification, rate limiting and audit logs if required.

## API overview
- `POST /api/auth/register` — create student account
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — current account
- `POST /api/complaints` — submit complaint (authenticated)
- `GET /api/complaints` — student's complaints or all complaints for admin
- `PATCH /api/complaints/:id` — admin updates status, priority and note
- `GET /api/dashboard` — admin dashboard counts
