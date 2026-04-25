DROP DATABASE IF EXISTS vsr_milk_products;
CREATE DATABASE vsr_milk_products;
USE vsr_milk_products;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('owner','customer') DEFAULT 'customer',
    gender ENUM('Male', 'Female', 'Other'),
    profile_image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    otp_code VARCHAR(10),
    expires_at DATETIME,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    category VARCHAR(100),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    house VARCHAR(255),
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    type ENUM('Home', 'Work', 'Other') DEFAULT 'Home',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    address_id INT,
    total_amount DECIMAL(10,2),
    status ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (address_id) REFERENCES addresses(id)
);

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    payment_method ENUM('cod','upi','card','netbanking'),
    payment_status ENUM('pending','completed','failed') DEFAULT 'pending',
    transaction_id VARCHAR(255),
    paid_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    invoice_number VARCHAR(100) UNIQUE,
    invoice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE user_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    activity VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

SHOW TABLES;

INSERT INTO users (name, email, phone_number, password, role)
VALUES
('Ramesh Kumar','ramesh@gmail.com','9876543210','123456','customer'),
('Sita Devi','sita@gmail.com','9876543211','123456','customer'),
('Admin User','admin@vsrmilk.com','9876543212','admin123','owner'),
('nanireddy ' , 'nani@gmail.com' , '9550629537' , 'nani','customer');

SELECT * FROM users;

DELETE FROM products;
INSERT INTO products (name, description, price, image_url, stock) VALUES
('Buffalo Milk','Fresh farm buffalo milk',37,'images/milk_product.png',100),
('Pure Ghee','Traditional homemade ghee',425,'images/ghee_product.png',50),
('Fresh Curd','Natural creamy curd',40,'images/curd_image.png',80),
('Fresh Paneer','Soft homemade paneer',225,'images/paneer_product.png',40);

SELECT * FROM products;



INSERT INTO addresses (user_id, house, street, city, state, pincode, type, is_default)
VALUES
(1,'House 12','MG Road','Hyderabad','Telangana','500001','Home', 1),
(2,'Flat 4B','Banjara Hills','Hyderabad','Telangana','500034','Home', 1),
(3, 'sc-p12' , 'jubillie hills' , 'Hyderabad' , 'Telegana' , '500068' , 'Work', 1),
(4, 'pk-k90' , 'shakkot' , 'punjabi' , 'pakistan' , '90082' , 'Home', 1);

SELECT * FROM addresses;



INSERT INTO orders (user_id,address_id,total_amount,status)
VALUES
(1,1,110,'confirmed'),
(2,2,650,'pending');

SELECT * FROM orders;




INSERT INTO order_items (order_id,product_id,quantity,price)
VALUES
(1,1,2,50),
(1,4,1,90),
(2,5,1,650);

SELECT * FROM order_items;



INSERT INTO payments (order_id,payment_method,payment_status,transaction_id)
VALUES
(1,'upi','completed','TXN12345'),
(2,'cod','pending','TXN67890');

SELECT * FROM payments;



INSERT INTO wishlist (user_id,product_id)
VALUES
(1,5),
(2,3);


INSERT INTO reviews (user_id,product_id,rating,comment)
VALUES
(1,1,5,'Very fresh milk'),
(2,5,4,'Good quality ghee');


INSERT INTO user_activity (user_id,activity)
VALUES
(1,'Logged in'),
(1,'Placed an order'),
(2,'Added product to wishlist');


INSERT INTO files (user_id,file_name,file_path)
VALUES
(1,'profile.jpg','/uploads/profile.jpg'),
(2,'invoice.pdf','/uploads/invoice.pdf');


SELECT users.name, orders.id, orders.total_amount
FROM orders
JOIN users ON orders.user_id = users.id;

SELECT products.name, order_items.quantity, order_items.price
FROM order_items
JOIN products ON order_items.product_id = products.id;


SELECT users.name, products.name, reviews.rating
FROM reviews
JOIN users ON reviews.user_id = users.id
JOIN products ON reviews.product_id = products.id;

CREATE TABLE cart (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT,
product_id INT,
quantity INT,
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (product_id) REFERENCES products(id)
);


DESCRIBE cart;
SELECT * FROM cart;
