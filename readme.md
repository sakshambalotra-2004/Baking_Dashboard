# Baking Dashboard 🍰

A full-stack baking dashboard application built using Node.js, Express, and MongoDB.
The project provides backend APIs and dashboard functionality for managing baking runs, records, and analytics.

---

## Features

* Backend REST API with Express.js
* MongoDB database integration
* Baking run management
* Dashboard data handling
* Seed data support
* Modular folder structure
* Nodemon for development

---

# Tech Stack

## Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Nodemon

## Package Management

* npm

---

# Project Structure

```text
Baking_Dashboard/
│
├── package.json
├── package-lock.json
├── tree.txt
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   ├── seedRuns.js
│   │
│   ├── models/
│   │   └── Run.js
│   │
│   └── node_modules/
```

---

# Installation

## 1. Clone the Repository

```bash
git clone https://github.com/sakshambalotra-2004/Baking_Dashboard.git
```

---

## 2. Navigate to Project Folder

```bash
cd Baking_Dashboard
```

---

## 3. Install Root Dependencies

```bash
npm install
```

---

## 4. Install Backend Dependencies

```bash
cd backend
npm install
```

---

# Running the Project

## Start Backend Server

Inside backend folder:

```bash
npm start
```

or for development:

```bash
npm run dev
```

---

# Database Setup

Make sure MongoDB is running locally or provide a MongoDB Atlas connection string.

Example `.env`:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

---

# Seed Sample Data

To insert sample baking runs:

```bash
node seedRuns.js
```

---

# API Entry Point

Main backend server:

```text
backend/server.js
```

---

# Model Structure

## Run Model

Located at:

```text
backend/models/Run.js
```

Handles baking run schema and database operations.

---

# Development Notes

* Uses Nodemon for auto-reload during development
* Modular backend structure for scalability
* MongoDB used for persistent storage

---

# Future Improvements

* Frontend dashboard UI
* Authentication & Authorization
* Analytics charts
* Export reports
* Role-based access control
* Docker deployment

---

# Author

**Saksham Sharma**

GitHub: https://github.com/sakshambalotra-2004
