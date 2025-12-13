# Deployment & Migration Guide (JSON to MongoDB)

## 🚨 Why the Change?
Storing user and product data in **JSON files (`users.json`, `products.json`)** works only for local development. In cloud environments like **Railway**:
1.  **Ephemeral Filesystem**: Every time you deploy or restart the server, the filesystem is reset to the state of the Git repository.
2.  **Data Loss**: Any user registered or product added *after* deployment is deleted upon the next restart.
3.  **Concurrency**: Multiple requests writing to the same file simultaneously can corrupt the data.

We have migrated to **MongoDB**, a production-ready database that runs independently of your app server, ensuring data persists effectively.

## 🛠️ Step 1: Set Up MongoDB Atlas (Or Use Existing)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free cluster.
3. Create a Database User (Username/Password).
4. Get the **Connection String** (URI).
   - It looks like: `mongodb+srv://user:password@cluster.mongodb.net/dbname?...`

## 🚀 Step 2: Configure Railway
In your Railway project **Variables** tab, add the following:

| Variable Name | Value | Description |
|Distro|Value|Desc|
| `MONGO_URI` | `mongodb+srv://...` | Your actual connection string |
| `JWT_SECRET` | `your_secure_secret` | Secret for login tokens |
| `NODE_ENV` | `production` | Optimizes Express for production |

## ⚠️ Important Notes
- **Old Data**: The data previously in `users.json` is **NOT** automatically moved to MongoDB. You start with a fresh database.
- **IDs**: MongoDB uses alphanumeric IDs (e.g., `657a8...`) instead of numbers (e.g., `1`, `2`). The code has been updated to handle this, but if you have hardcoded generic IDs in your frontend validation, double-check them.

## 📁 Project Structure Changes
- **Deleted/Ignored**: `database/users.json`, `database/products.json` are no longer used.
- **Added**: `config/db.js` (DB Connection).
- **Added**: `models/User.js` (User Schema).
- **Added**: `models/Product.js` (Product Schema).
- **Updated**: `server.js` (Refactored to use Mongoose).
