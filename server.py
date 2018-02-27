from flask import Flask, request, render_template
from geventwebsocket.handler import WebSocketHandler
from gevent.pywsgi import WSGIServer
from geventwebsocket import WebSocketError
import sys, json, uuid
import database_helper as dh

app = Flask(__name__)

#resets the server
if len(sys.argv) == 2:
    if sys.argv[1] == "r":
        print('reset server')
        dh.reset_db(app)

#maps token to websocket
logged_in_usrs = {}

#helper function for creating server return messages
def return_message(success, message, data=[]):
    return json.dumps({'success': success, 'message': message, 'data': data})

#called from sockets(), closes old sockets and adds new
def register_socket(token, ws):
    if token in logged_in_usrs:
        logged_in_usrs[token].close()
        del logged_in_usrs[token]
    logged_in_usrs[token] = ws

#websocket for logged in users. is run on login
@app.route('/ws')
def sockets():
    msg = ""
    if request.environ.get('wsgi.websocket'):
        try:
            token = ""
            ws = request.environ['wsgi.websocket']
            while not ws.closed:
                response = ''
                msg = json.loads(ws.receive())
                if msg['command'] == 'login':
                    token = msg['token']
                    register_socket(token, ws)
                    response = 'login done'
                ws.send(response)
        except WebSocketError as e:
            print(e)
            print(msg)
        finally:
            return ''
    return ''

""" helper function for dertermining if request has
invalid inputs"""
def has_incorrect_content(content, keys):
    key = ""
    try:
        for k in keys:
            key = k
            a = content[k]
        return False
    except KeyError as e:
        return key

#Mock method for validating credentials with Päron AB
def validate(email, password):
    return True

#home route
@app.route('/', methods=['GET'])
def home():
    return app.send_static_file('client.html');

'''
return a valid token if provided user info is correct
in {email, password}
out {success, message, data: token}
'''
@app.route('/sign_in', methods=['POST'])
def sign_in():
    token = request.headers.get('Authorization')
    if not token:
        return return_message(False, 'Invalid request')
    content = request.json
    if not content:
        return return_message(False, 'Invalid request')
    #Authenticate with Päron AB. assuming all is good
    if not validate(content['email'], content['password']):
        return return_message(False, 'Wrong email or password')
    new_token = register_new_user()
    if not new_token:
        return return_message(False, 'Server error')
    return return_message(True, '', new_token)

"""
returns all that is stored in the storages
input: valid token
output: entire storages database
"""
@app.route('/storages_data', methods=['GET'])
def get_storages_data():
    token = request.headers.get('Authorization')
    if not token:
        return return_message(False, 'Invalid request')
    if not token in logged_in_usrs:
        return return_message(False, 'Invalid user')
    data = dh.get_storages_data()
    if data:
        return return_message(True, '', data)
    return return_message(False, 'No data available')

#new transaction specific request validation
def check_if_bad_transaction_request(content, token):
    if not token:
        return return_message(False, 'Invalid request')
    if not token in logged_in_usrs:
        return return_message(False, 'Invalid user')
    if not content:
        return return_message(False, 'Invalid request')
    key = has_incorrect_content(content, ['item', 'from', 'to', 'amount'])
    if key:
        return return_message(False, 'Missing content: ' + key)
    return False

"""
Creates a new transaction
input: {item, to, from, amount}
output: {success, message, data=None}
"""
@app.route('/transaction', methods=['POST'])
def new_transaction():
    content = request.json
    token = request.headers.get('Authorization')
    is_bad_request = check_if_bad_transaction_request(content, token)
    if is_bad_request:
        return is_bad_request
    if not content['from'] == 'factory':
        has_amount = dh.storage_has_amount(content['from'], content['item'], content['amount'])
        if not has_amount[0]:
            return return_message(False, 'Not enough in storage')
        dh.transaction(content['from'], content['item'], int(has_amount[1]) - int(content['amount']))
        dh.log_transaction(content['from'], content['item'], -int(content['amount']))
    if not content['to'] == 'stores':
        has_amount = dh.storage_has_amount(content['to'], content['item'], 0)
        dh.transaction(content['to'], content['item'], int(has_amount[1]) + int(content['amount']))
        dh.log_transaction(content['to'], content['item'], int(content['amount']))
    update_charts()
    return return_message(True, '')

#sends websocket msg to all logged in users to update charts
def update_charts():
    for usr in logged_in_usrs:
        ws = logged_in_usrs[usr]
        if not ws.closed:
            ws.send('update charts')

#helper function to create a valid token for new user
def register_new_user():
    new_token = str(uuid.uuid4())
    while new_token in logged_in_usrs:
        new_token = str(uuid.uuid4())
    return new_token

#returns all logged transactions
@app.route('/transactions', methods=['GET'])
def get_transactions():
    token = request.headers.get('Authorization')
    if not token in logged_in_usrs:
        return return_message(False, 'Invalid user')
    transactions = dh.get_transactions()
    if not transactions:
        return return_message(False, 'Server error')
    return return_message(True, '', transactions)

#returns all stored products
@app.route('/productInfo', methods=['GET'])
def get_prod_info():
    token = request.headers.get('Authorization')
    if not token in logged_in_usrs:
        return return_message(False, 'Invalid request')
    info = dh.get_prod_info()
    if not info:
        return return_message(False, 'Server error')
    return return_message(True, '', info)

#starts the WSGI server
def run_server():
    app.debug = True
    http_server = WSGIServer(('', 5000), app, handler_class=WebSocketHandler)
    http_server.serve_forever()

if __name__ == "__main__":
    try:
        print('running');
        run_server()
    finally:
        print('closing')
