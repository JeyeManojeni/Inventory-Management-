const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { db } = require('../server');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// GET /api/products (with pagination, sorting, filtering)
router.get('/', (req, res) => {
  const { page = 1, limit = 10, sort = 'name', order = 'asc', category } = req.query;
  const offset = (page - 1) * limit;
  let query = 'SELECT * FROM products';
  let params = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  query += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/products/search
router.get('/search', (req, res) => {
  const { name } = req.query;
  db.all('SELECT * FROM products WHERE name LIKE ?', [`%${name}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/products (Add new product)
router.post('/', [
  body('name').isLength({ min: 1 }),
  body('stock').isInt({ min: 0 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, unit, category, brand, stock, status, image } = req.body;
  db.run('INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, unit, category, brand, stock, status, image], function(err) {
      if (err) return res.status(400).json({ error: 'Product name must be unique' });
      res.status(201).json({ id: this.lastID });
    });
});

// PUT /api/products/:id
router.put('/:id', [
  body('name').isLength({ min: 1 }),
  body('stock').isInt({ min: 0 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { name, unit, category, brand, stock, status, image } = req.body;

  db.get('SELECT stock FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (product && product.stock !== stock) {
      db.run('INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_date, user_info) VALUES (?, ?, ?, ?, ?)',
        [id, product.stock, stock, new Date().toISOString(), req.user.username]);
    }
    db.run('UPDATE products SET name = ?, unit = ?, category = ?, brand = ?, stock = ?, status = ?, image = ? WHERE id = ?',
      [name, unit, category, brand, stock, status, image, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product updated' });
      });
  });
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted' });
  });
});

// POST /api/products/import
router.post('/import', upload.single('csvFile'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      let added = 0, skipped = 0;
      results.forEach((product) => {
        db.get('SELECT id FROM products WHERE name = ?', [product.name], (err, row) => {
          if (!row) {
            db.run('INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [product.name, product.unit, product.category, product.brand, product.stock, product.status, product.image]);
            added++;
          } else {
            skipped++;
          }
        });
      });
      fs.unlinkSync(req.file.path); // Clean up
      res.json({ added, skipped });
    });
});

// GET /api/products/export
router.get('/export', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const csvData = 'name,unit,category,brand,stock,status,image\n' +
      rows.map(row => `${row.name},${row.unit},${row.category},${row.brand},${row.stock},${row.status},${row.image}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send(csvData);
  });
});

// GET /api/products/:id/history
router.get('/:id/history', (req, res) => {
  db.all('SELECT * FROM inventory_history WHERE product_id = ? ORDER BY change_date DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;