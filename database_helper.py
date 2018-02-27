import json
import sqlite3
import uuid
import time
conn = sqlite3.connect('database.db', check_same_thread=False)
cursor = conn.cursor()

#registered products, the pretty print versions
products = ['jTelefon', 'jPlatta', 'Päronklocka']

#Make a database call
def query_db(query, args=(), one=False):
    cur = cursor.execute(query, args)
    rv = cur.fetchall()
    conn.commit()
    return (rv[0] if rv else None) if one else rv

#reset db
def reset_db(app):
    with app.app_context():
        with app.open_resource('schema.sql', mode='r') as f:
            cursor.executescript(f.read())
        conn.commit()
        query_db('INSERT INTO storages VALUES (?, ?, ?, ?, ?)', ('Cupertino', 1, 170000, 41500, 90000))
        query_db('INSERT INTO storages VALUES (?, ?, ?, ?, ?)', ('Norrköping', 2, 55000, 104300, 38000))
        query_db('INSERT INTO storages VALUES (?, ?, ?, ?, ?)', ('Frankfurt', 3, 101700, 72400, 25000))
        query_db('INSERT INTO products VALUES (?, ?, ?)', ('jTelefon', 'P001', 8900))
        query_db('INSERT INTO products VALUES (?, ?, ?)', ('jPlatta', 'P002', 5700))
        query_db('INSERT INTO products VALUES (?, ?, ?)', ('Päronklocka', 'P003', 11000))
        log_transaction('Norrköping', 'jtelefon', 200)

#returns all the information in storages
def get_storages_data():
    data = query_db('SELECT * FROM storages')
    if not data:
        return None
    result = []
    for item in data:
        data_obj = {}
        data_obj['site'] = item[0]
        for index, product in enumerate(products):
            data_obj[product] = item[index + 2]
        result.append(data_obj)
    return result

"""
returns if storages has amount of item, returns
stored amount if enough
"""
def storage_has_amount(storage, item, amount):
    in_storage = query_db('SELECT ' + item + ' FROM storages WHERE name=?', (storage,), True)
    if not in_storage:
        return (False, 'Server error')
    if int(amount) <= int(in_storage[0]):
        return (True, in_storage[0])
    return (False, 'Not enough in storage')

#updates storages with new item amount
def transaction(storage, item, new_amount):
    query_db('UPDATE storages SET ' + item + '=? WHERE name=?', (new_amount, storage))

#logges a transaction
def log_transaction(storage, item, amount):
    query_db('INSERT INTO transactions VALUES (?, ?, ?, ?)', (storage, item, amount, time.strftime('%Y-%m-%d %H:%M:%S')))

#returns logged transactions
def get_transactions():
    return query_db('SELECT * FROM transactions', (), False)

#returns stored product info
def get_prod_info():
    return query_db('SELECT * FROM products', (), False)
