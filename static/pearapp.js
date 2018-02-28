'use strict';
//data for charts
var barChartData;

window.onload = newView;

//display a snackbar with msg 'str'
function snackbar(str) {
    var bar = document.getElementById("snackbar")
    bar.innerText = str;
    bar.className = "show";
    setTimeout(function(){ bar.className = bar.className.replace("show", ""); }, 3000);
}

//retrieve locally stored token
function getToken() {
    return localStorage.getItem('token');
}

//displays the given view in html
function setView(newView) {
    var view = document.getElementById(newView).innerHTML;
    document.getElementById('currView').innerHTML = view;
}

/*init three modal boxes used for new transactions,
viewing transactions and product info - called when
chartsview is set*/
function initModalBoxes() {
    var newTransModal = document.getElementById('newTransactionPopup');
    var newTransSpan = document.getElementById("closeNewTrans");
    var newTransBtn = document.getElementById('transactionButton');
    var viewTransModal = document.getElementById('viewTransactionPopup');
    var viewTransSpan = document.getElementById('viewTransSpan');
    var viewTransBtn = document.getElementById('viewTransactionsButton');
    var infoPopup = document.getElementById('infoPopup');
    var infoSpan = document.getElementById('infoSpan');
    var infoButton = document.getElementById('viewInfoButton');

    infoSpan.onclick = function() {
        infoPopup.style.display = "none";
    }
    newTransSpan.onclick = function() {
        newTransModal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == newTransModal) {
            newTransModal.style.display = "none";
        } else if (event.target == viewTransModal) {
            viewTransModal.style.display = "none";
        } else if (event.target == infoPopup) {
            infoPopup.style.display = "none";
        }
    }
    newTransBtn.onclick = function() {
        newTransModal.style.display = "block";
    }
    viewTransSpan.onclick = function() {
        viewTransModal.style.display = "none";
    }
    viewTransBtn.onclick = function() {
        viewTransModal.style.display = "block";
        getTable('/transactions', 'transactionsContainer', ['Storage', 'Product', 'Amount', 'Date']);
    }
    viewInfoButton.onclick = function() {
        infoPopup.style.display = "block";
        getTable('/productInfo', 'infoContainer', ['Name', 'Id number', 'Price']);
    }
}

/*fetches table data from server and creates a table in
the given  target*/
function getTable(route, target, headers) {
    xmlHttpReq('GET', route, '', function(responseText) {
        var response = JSON.parse(responseText);
        if (response.success) {
            var data = response.data;
            var table = document.createElement('table');
            var tr = document.createElement('tr');
            for (var head in headers) {
                var th = document.createElement('th');
                th.innerText = headers[head];
                tr.appendChild(th);
            }
            table.appendChild(tr);
            for (var trans in data) {
                var tr = document.createElement('tr');
                for (var i = 0; i < data[trans].length; i++) {
                    var td = document.createElement('td');
                    td.innerText = data[trans][i];
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            var cont = document.getElementById(target);
            cont.innerHTML = "";
            cont.appendChild(table);
        } else {
            snackbar(response.message);
        }
    });
}

/*called on login and reload to set up either chartsView
or loginview. socketcall is a flag which is null on reload
so we can reestablish socket connection*/
function newView(socketCall) {
    var token = getToken();
    if (token) {
        setView('chartsView');
        initCharts();
        initModalBoxes();
        if (socketCall != 'socketCall') {
            setUpWebSocket();
        }
    } else {
        setView('loginView');
    }
}

/*Helper function to make server requests.
body should be json if anything, callback is callback function*/
function xmlHttpReq(method, url, body, callback) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            callback(xhttp.responseText);
        }
    }
    xhttp.open(method, url, true);
    if (method == 'POST')
        xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.setRequestHeader('Authorization', localStorage.getItem('token'));
    xhttp.send(body);
}

/*helper funciton to get a js object*/
function getSubmittedData(elements) {
    var obj = {};
    for (var i = 0; i < elements.length; i++) {
        var item = elements.item(i);
        obj[item.name] = item.value;
    }
    return obj;
}

/*log out user by removing token and updating view*/
function logOut() {
    localStorage.removeItem('token');
    newView();
}

/*set up the websocket that handles login/logout
and update calls from the server*/
function setUpWebSocket() {
    var wsc = new WebSocket('ws://' + window.location.host + '/ws');
    var token = getToken();
    wsc.onclose = function() {
        logOut();
    };
    wsc.onopen = function() {
        wsc.send(JSON.stringify(
            {'command' : 'login',
            'token' : token}
        ));
    };
    wsc.onerror = function(error) {
        console.log('Error: ' + error + " for " + token);
    };
    wsc.onmessage = function(response) {
        switch(response.data) {
            case "logout":
                wsc.close();
                break;
            case "login done":
                newView('socketCall');
                break;
            case 'update charts':
                updateCharts();
                break;
            default:
                snackbar(response.data);
        }
    };
}

/*called on login, signs in user with server
if valid credentials entered*/
function loginSubmit() {
    var elements = getSubmittedData(document.getElementById('loginForm').elements);
    var json_body = JSON.stringify({
        "email" : elements.email,
        "password" : elements.password
    });

    //send to server
    xmlHttpReq('POST', '/sign_in', json_body, function(responseText) {
        var response = JSON.parse(responseText);
        if (response.success) {
            localStorage.setItem("token", response.data);
            setUpWebSocket();
        } else {
            snackbar(response.message);
            logOut();
        }
    });
    return false;
}

/*called to initialize the charts. fetches data from Server
and calls drawCharts*/
function initCharts() {
    xmlHttpReq('GET', '/storages_data', '', function(responseText) {
        var response = JSON.parse(responseText);
        if (response.success) {
            drawCharts(response.data);
        } else {
            snackbar(response.message);
        }
    });
}

/*Helper funciton to retrieve a column of an
array of js obj*/
function getColumn(data, c) {
    var result = [];
    var key = Object.keys(data[0])[c];
    for (var item in data) {
        result.push(data[item][key]);
    }
    return result;
}

/*creates datasets for the charts given data
and return an array of datasets*/
function getDatasets(data) {
    var result = [];
    var color = Chart.helpers.color;
    var cc = window.chartColors;
    var colorPalette = [cc.red, cc.green, cc.blue, cc.black, cc.pink];
    for (var i = 1; i < Object.keys(data[0]).length; i++) {
        var colorPicker = (i-1) % colorPalette.length;
        var obj = {
            label: Object.keys(data[0])[i],
            backgroundColor : color(colorPalette[colorPicker]).alpha(0.5).rgbString(),
            borderColor : colorPalette[colorPicker],
            borderWidth : 1,
            data: getColumn(data, i)
        };
        result.push(obj);
    }
    return result;
}

/*Called via websocket, refetches chart data and updates
charts with it*/
function updateCharts() {
    if (barChartData) {
        xmlHttpReq('GET', '/storages_data', '', function(responseText) {
            var response = JSON.parse(responseText);
            if (response.success) {
                barChartData.datasets = getDatasets(response.data);
                window.myBar.update();
            } else {
                snackbar(response.message);
            }
        });
    }
}

/*inital drawing of the charts, creates the myBar.*/
function drawCharts(data) {
    var sites = getColumn(data, 0);
    barChartData = {
        labels : sites,
        datasets : getDatasets(data)
    };
    var ctx = document.getElementById('canvas').getContext('2d');
    window.myBar = new Chart(ctx, {
        type: 'bar',
        data: barChartData,
        options: {
            response: true,
            legend: {
                position: 'top'
            },
            title: {
                display: true,
                text: 'Päron AB'
            }
        }
    });
    window.myBar.update();
}

/*perform a transaction with the transaction form
makes a server call*/
function transactionSubmit() {
    var trans = getSubmittedData(document.getElementById('transactionForm').elements);
    if (trans.to == trans.from) {
        snackbar('Cannot transfer to same site');
        return false;
    }
    if (trans.from == 'factory' && trans.to == 'stores') {
        snackbar('Cannot transfer from factory directly to stores');
        return false;
    }
    var json_body = JSON.stringify(trans);
    xmlHttpReq('POST', '/transaction', json_body, function(responseText) {
        var response = JSON.parse(responseText);
        if (response.success) {
            snackbar('Transaction successful');
        } else {
            snackbar(response.message);
        }
    });
    document.getElementById('newTransactionPopup').style.display = "none";
    return false;
}
