# cPanel Deployment Instructions

To deploy this application to your cPanel hosting:

## 1. Backend (PHP API)
1. In cPanel, go to **FileManager**.
2. Create a folder named `api` in your `public_html` directory (or wherever your app will live).
3. Upload the contents of the `cpanel/api/` folder from this project to your new `api/` folder.
4. Create a MySQL database in cPanel (e.g., `cse_portfolio`).
5. Import the `cpanel/database.sql` file into your database using **phpMyAdmin**.
6. Edit `api/db.php` on your server and update the database name, username, and password.

## 2. Frontend (React)
1. On your local machine, run `npm run build`.
2. This generates a `dist/` folder.
3. Upload the contents of `dist/` to your public directory (e.g., `/public_html/app`).
4. **Important**: Since this is a Single Page Application (SPA), you need an `.htaccess` file in your app folder to support routing.
   
### Example .htaccess
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /app/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /app/index.html [L]
</IfModule>
```
5. Update the `API_BASE` in `src/services/api.ts` to your production URL (e.g., `https://yourdomain.com/api`) before building, OR configure your web server to reverse proxy `/api` (recommended).

## 3. SEO & Metadata
- Update the `index.html` title and meta tags as needed.
- Update the `favicon`.

## 4. Security
- The PHP API uses prepared statements to prevent SQL injection.
- Ensure your `db.php` is NOT publicly accessible.
- Consider adding JWT authentication to the PHP API if you need more robust security (this version uses simple session/JSON response for ease of setup).
