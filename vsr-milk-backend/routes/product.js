const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {

    const sql = "SELECT * FROM products";

    db.query(sql, (err, result) => {

        if (err) {
            console.log(err);
            res.status(500).json(err);
        }

        res.json(result);

    });

});

module.exports = router;