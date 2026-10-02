# Learning Management System (LMS)

A comprehensive full-stack Learning Management System with authentication, payments, classrooms, assignments, and integrations.

## Features

### 1. Authentication System
- **Role Types:**
  - **Root Admin** - Full system access, user management, payment management
  - **School Admin** - Manage teachers, classes, students, pricing and payments
  - **Teacher (under a school)** - Create classes, add topics, manage content, manage assignments
  - **Personal Teacher** - Create classes, add topics, manage content, manage assignments, manage students, payment and pricing management
  - **Student** - Enroll in classes, access content, submit assignments, receive email notifications, make payments

### 2. Payment Integration
- Pay-per-class / Pay-per-topic / Pay-per-subject enrollment system
- Payment history tracking
- Secure transaction records (Stripe integration)
- Instant enrollment after payment

### 3. Classroom Management
- Create multiple classrooms
- Assign teachers to classes
- Set schedules and pricing
- Track student enrollment
- Student capacity management

### 4. Topics System
- Add topics/lessons to each class
- Organize course content
- Topic descriptions and materials
- Easy content management
- Class work management

### 5. Zoom Integration
- One-click Zoom meeting launch
- Auto-generated meeting IDs
- Password-protected sessions
- Direct access from classroom

### 6. Whiteboard Integration
- Interactive board access
- Real-time collaboration
- Direct launch from classes
- Unique board URLs per class

### 7. Email Notifications
- Class reminders (Teacher and Students)
- Assignment reminders (Teacher and Students)
- Assignment results (Teacher and Students)
- Payment/Subscription notifications (Personal Teacher and School Admin)

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT Authentication
- Stripe for payments
- Nodemailer for emails
- Zoom API integration

### Frontend
- React 18
- React Router
- Vite
- Tailwind CSS
- Axios for API calls
- Lucide React for icons

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Stripe account (for payments)
- Email account (for notifications)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lms
JWT_SECRET=your-super-secret-jwt-key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

5. Seed the database with demo accounts:
```bash
node seed.js
```

6. Start the server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Demo Accounts

After seeding the database, you can use these accounts:

- **Root Admin:** admin@lms.com / admin123
- **School Admin:** schooladmin@lms.com / admin123
- **Teacher:** teacher@lms.com / teacher123
- **Personal Teacher:** personalteacher@lms.com / teacher123
- **Student:** student@lms.com / student123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create user (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Root Admin only)

### Classrooms
- `GET /api/classrooms` - Get all classrooms
- `GET /api/classrooms/:id` - Get classroom by ID
- `POST /api/classrooms` - Create classroom
- `PUT /api/classrooms/:id` - Update classroom
- `DELETE /api/classrooms/:id` - Delete classroom
- `POST /api/classrooms/:id/enroll` - Enroll in classroom

### Topics
- `GET /api/topics/classroom/:classroomId` - Get topics for classroom
- `GET /api/topics/:id` - Get topic by ID
- `POST /api/topics` - Create topic
- `PUT /api/topics/:id` - Update topic
- `DELETE /api/topics/:id` - Delete topic

### Assignments
- `GET /api/assignments/classroom/:classroomId` - Get assignments for classroom
- `GET /api/assignments/:id` - Get assignment by ID
- `POST /api/assignments` - Create assignment
- `POST /api/assignments/:id/submit` - Submit assignment
- `PUT /api/assignments/:id/grade` - Grade assignment

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/:id` - Get payment by ID
 - `POST /api/payments/paystack/initiate` - Initiate Paystack transaction
 - `GET /api/payments/paystack/verify` - Verify Paystack transaction reference
 - `POST /api/payments/paystack/webhook` - Paystack webhook receiver (server-side)

Frontend callback (optional): `https://<your-domain>/payments/verify`
 - Purpose: user-facing redirect after completing payment. The page reads the `reference` query parameter and calls `GET /api/payments/paystack/verify?reference=...` to finalize verification.

### Zoom
- `POST /api/zoom/create-meeting/:classroomId` - Create Zoom meeting
- `GET /api/zoom/meeting/:classroomId` - Get Zoom meeting details

### Whiteboard
- `GET /api/whiteboard/:classroomId` - Get whiteboard URL
- `POST /api/whiteboard/:classroomId/create` - Create whiteboard session

### Notifications
- `POST /api/notifications/class-reminder/:classroomId` - Send class reminder
- `POST /api/notifications/assignment-reminder/:assignmentId` - Send assignment reminder
- `POST /api/notifications/assignment-result/:assignmentId/:studentId` - Send assignment result
- `POST /api/notifications/payment-notification` - Send payment notification

## Project Structure

```
LMS/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── server.js       # Express server
│   ├── seed.js         # Database seeder
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context
│   │   ├── utils/      # Utility functions
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Development

### Running in Development Mode

1. Start MongoDB (if running locally)
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`

### Building for Production

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `STRIPE_SECRET_KEY` - Stripe secret key
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `ZOOM_API_KEY` - Zoom API key (optional)
- `ZOOM_API_SECRET` - Zoom API secret (optional)
 - `PAYSTACK_SECRET_KEY` - Paystack secret key (required if using Paystack)
 - `PAYSTACK_CURRENCY` - Currency code for Paystack amounts (e.g., `NGN`)

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
 - `VITE_PAYSTACK_PUBLIC_KEY` - Paystack public key for inline widget (optional)

## Security Notes

- Change JWT_SECRET in production
- Use environment variables for all sensitive data
- Enable HTTPS in production
- Implement rate limiting
- Add input validation and sanitization
- Use secure password hashing (already implemented with bcrypt)

## License

MIT License

## Support

For issues and questions, please open an issue on the repository.

