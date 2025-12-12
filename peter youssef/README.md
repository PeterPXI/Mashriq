# مشرق Mashriq ☀️

> **منصة الإبداع والتسويق للطلاب**  
> A Student Marketplace Platform for WE School

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![License](https://img.shields.io/badge/License-ISC-yellow)

---

## 🌅 About

Mashriq (مشرق) is a modern marketplace platform designed for students to showcase and sell their products and services. Built with a sunrise theme representing new beginnings and opportunities.

### Features
- 🛍️ Product listings with categories
- 👤 User authentication (register/login)
- 📊 Dashboard for sellers
- 🎨 Beautiful RTL Arabic interface
- 📱 Fully responsive design
- 🔒 Secure JWT authentication

---

## 📁 Project Structure

```
mashriq/
├── server.js           # Express backend server
├── package.json        # Dependencies & scripts
├── railway.json        # Railway deployment config
├── database/           # JSON database files
│   ├── users.json
│   └── products.json
└── public/             # Frontend files
    ├── index.html      # Homepage
    ├── products.html   # Products listing
    ├── login.html      # Login page
    ├── register.html   # Registration page
    ├── dashboard.html  # User dashboard
    ├── style.css       # Main styles
    ├── app.js          # Frontend logic
    ├── api.js          # API client
    └── logo.png        # Mashriq logo
```

---

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd mashriq

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

### Demo Accounts
| Email | Password | Type |
|-------|----------|------|
| student@demo.com | demo123 | Student |
| seller@demo.com | demo123 | Seller |

---

## 🌐 Deployment

### Railway (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Railway auto-detects Node.js and deploys

3. **Environment Variables** (Optional)
   ```
   NODE_ENV=production
   JWT_SECRET=your_secure_secret
   ```

### Other Platforms
- **Render**: Works out of the box
- **Fly.io**: Use `fly launch`
- **Heroku**: Use Procfile with `web: npm start`

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health status |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: JSON files (file-based)
- **Authentication**: JWT, bcryptjs
- **Frontend**: HTML5, CSS3, JavaScript
- **Icons**: Font Awesome 6
- **Fonts**: Cairo (Arabic), Inter (English)

---

## 👤 Author

**Peter Youssef**  
WE School Student

---

## 📄 License

ISC License - See LICENSE file for details.

---

<p align="center">
  <strong>☀️ ابدأ رحلة النجاح مع مشرق</strong><br>
  <em>Start your success journey with Mashriq</em>
</p>
