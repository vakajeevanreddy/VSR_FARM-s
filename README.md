<<<<<<< HEAD
# VSR FARM'S - Milk Products Management System

A full-stack application for managing milk products, orders, and customer profiles.

## Project Structure
- `vsr-milk-backend/`: Node.js Express backend.
- `vsr-milk-products/`: HTML/JS frontend (served by the backend).

## Prerequisites
- Node.js (v14 or higher)
- MySQL Server

## Getting Started

### 1. Database Setup
- Open your MySQL terminal or workbench.
- Run the SQL script located at: `vsr-milk-products/vsr_milk_products.sql`.
- This will create the database `vsr_milk_products` and populate initial data.

### 2. Backend Configuration
- Navigate to `vsr-milk-backend/`.
- Open `.env` and update your MySQL credentials:
  ```env
  DB_HOST=localhost
  DB_USER=your_username
  DB_PASSWORD=your_password
  DB_NAME=vsr_milk_products
  ```

### 3. Install Dependencies & Run
```bash
# In the root directory
cd vsr-milk-backend
npm install
npm start
```
- The server will run at `http://localhost:5000`.
- The frontend is served automatically. Open `http://localhost:5000` in your browser.

## Deployment to Render (ranstandard)
1. Push your code to a GitHub repository.
2. Connect your GitHub repo to Render.
3. **Environment Variables on Render**:
   - `PORT`: 10000 (Render default)
   - `DB_HOST`: Your managed MySQL host
   - `DB_USER`: Your managed MySQL user
   - `DB_PASSWORD`: Your managed MySQL password
   - `DB_NAME`: vsr_milk_products
   - `JWT_SECRET`: A long random string

## GitHub Workflow
```bash
git init
git add .
git commit -m "Fixed errors and prepared for deployment"
git remote add origin https://github.com/yourusername/vsr_farms.git
git branch -M main
git push -u origin main
```
=======
# VSR_FARM-s
E commerce Dairy Farm Website
>>>>>>> 3d6cb0c8247f9ad47ed12c0c2d9dec38a32df911
