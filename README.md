# Finance Data Processing and Access Control Backend

## Overview


This project implements a **Finance Dashboard Backend API** that manages financial records and enforces **role-based access control**.

The system allows different users (Viewer, Analyst, Admin) to interact with financial records and provides **aggregated financial insights for a dashboard**.

The backend is built using **Django and Django REST Framework**, focusing on clean architecture, structured APIs, and maintainable backend logic.

---

## Live API Deployment

The backend API is deployed and accessible online.

* Base URL:

    https://finance-dashboard-backend-production-3173.up.railway.app/

Example Endpoints:

* Dashboard Summary:
  
    https://finance-dashboard-backend-production-3173.up.railway.app/api/dashboard/summary/

* Users API:

    https://finance-dashboard-backend-production-3173.up.railway.app/api/users/

* Financial Records API:
  
    https://finance-dashboard-backend-production-3173.up.railway.app/api/records/

The API can also be explored through the Django REST Framework browsable API interface.

---

## Features

### 0. Web Frontend

* Root dashboard page at `/`
* Secure login page backed by expiring bearer tokens
* Self signup for normal User accounts
* Separate Admin, Analyst, and User workspaces
* Light and dark mode
* Summary cards for income, expenses, and net balance
* Category totals and recent transactions
* Financial record management from the browser
* Personal and team record scopes
* User and role management from the browser
* Admin-managed user passwords
* Forgot password / reset password flow
* Audit log for create, update, delete, login, logout, and password reset events

### 1. User and Role Management

* Create and manage users
* Assign roles: **Viewer, Analyst, Admin**
* Activate or deactivate users
* Restrict actions based on user roles

### 2. Financial Records Management

Users can manage financial records including:

* Amount
* Type (Income / Expense)
* Category
* Date
* Description

Supported operations:

* Create records
* View records
* Update records
* Delete records

---

### 3. Dashboard Summary API

Provides aggregated financial insights including:

* Total income
* Total expenses
* Net balance
* Category-wise totals
* Recent transactions

---

### 4. Role-Based Access Control

| Role    | Permissions                                                  |
| ------- | ------------------------------------------------------------ |
| User    | View dashboard summary and manage their own personal records |
| Analyst | View team records, view/manage their own records, and dashboard |
| Admin   | Full access to users, records, team data, and audit history |

---

### 5. Token Authentication

The frontend and API use secure bearer tokens.

* Users sign in with email and password
* Passwords are stored as Django password hashes
* Raw tokens are shown only once to the browser
* The database stores only SHA-256 token hashes
* Tokens expire after 12 hours
* Logout revokes the active token
* Password reset tokens expire after 30 minutes

Example authenticated request:

```
Authorization: Bearer <token>
```

---

### 6. Filtering Support

Records can be filtered using query parameters.

Example:

```
/api/records/?type=income
/api/records/?category=salary
/api/records/?date=2026-04-01
```

---

### 7. Pagination

API responses support pagination to efficiently handle large datasets.

Example:

```
/api/records/?page=1
/api/records/?page=2
```

---

## API Endpoints

### Frontend

```
GET /
```

### Authentication

```
POST /api/auth/login/
POST /api/auth/signup/
POST /api/auth/logout/
GET  /api/auth/me/
POST /api/auth/password-reset/
POST /api/auth/password-reset/confirm/
```

### Users

```
GET    /api/users/
POST   /api/users/
PUT    /api/users/{id}/
DELETE /api/users/{id}/
```

---

### Financial Records

```
GET    /api/records/
POST   /api/records/
PUT    /api/records/{id}/
DELETE /api/records/{id}/
```

Records support `scope`:

```
personal
team
```

### Audit Logs

```
GET /api/audit-logs/
```

Only admin users can access audit logs.

---

### Dashboard

```
GET /api/dashboard/summary/
```

---

## Tech Stack

* **Python**
* **Django**
* **Django REST Framework**
* **SQLite Database**

---

## Project Structure

```
finance_dashboard_backend
│
├── users
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
│
├── records
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
│
├── dashboard
│   ├── views.py
│   └── urls.py
│
├── config
│   ├── settings.py
│   └── urls.py
│
├── manage.py
├── requirements.txt
└── README.md
```

---

## Setup Instructions

### 1. Clone Repository

```
git clone <repository-url>
```

### 2. Navigate to Project Folder

```
cd finance_dashboard_backend
```

### 3. Create Virtual Environment

```
python -m venv venv
```

### 4. Activate Environment

Windows:

```
venv\Scripts\activate
```

---

### 5. Install Dependencies

```
pip install -r requirements.txt
```

---

### 6. Apply Database Migrations

```
python manage.py migrate
```

---

### 7. Set a Password for an Existing User

Existing users created before the secure login upgrade need a password.

```
python manage.py set_user_password user@example.com
```

You can also pass it directly:

```
python manage.py set_user_password user@example.com --password StrongPass123
```

To create or update a dashboard admin login:

```
python manage.py create_dashboard_admin admin@example.com
```

For password reset emails, configure Django email settings on the server. The API does not expose reset tokens in responses.

---

### 8. Run the Server

```
python manage.py runserver
```

Open in browser:

```
http://127.0.0.1:8000/
```

---

## API Screenshots

### Dashboard Summary

![Dashboard](screenshots/dashboard_summary.png)

### Records API

![Records](screenshots/records_api.png)

### Users API
![Dashboard](screenshots/users_api.png)

---

## Author

**Manoj V Poojar**

Backend Developer – Python | Django | REST APIs
