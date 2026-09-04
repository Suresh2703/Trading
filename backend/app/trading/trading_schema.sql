-- If you are using PostgreSQL or SQL Server, you can run this script to create the 'trading' schema and its tables.
-- Note: SQLite does not support the 'CREATE SCHEMA' command.

CREATE SCHEMA IF NOT EXISTS trading;

CREATE TABLE IF NOT EXISTS trading.orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'BUY' or 'SELL'
    quantity INTEGER NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trading.transactions (
    id SERIAL PRIMARY KEY,
    buy_order_id INTEGER REFERENCES trading.orders(id),
    sell_order_id INTEGER REFERENCES trading.orders(id),
    product_id INTEGER NOT NULL,
    executed_quantity INTEGER NOT NULL,
    execution_price DECIMAL(15, 2) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
